package chat

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	agentmodel "echo-backend/internal/models/agent"

	msgconst "echo-backend/internal/constants/msg"

	domainconst "echo-backend/internal/constants/domain"
)

type ToolCallResult struct {
	ToolName string
	Content  string
}
type ToolCallCapture struct {
	ToolName  string
	ToolInput json.RawMessage
}

type AgentUsage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
	TotalTokens      int `json:"totalTokens"`
}

type AgentSSEPacket struct {
	Type       string          `json:"type"`
	Content    string          `json:"content"`
	Title      string          `json:"title"`
	Summary    string          `json:"summary"`
	ToolName   string          `json:"toolName"`
	ToolInput  json.RawMessage `json:"toolInput"`
	ToolResult string          `json:"toolResult"`
	Usage      *AgentUsage     `json:"usage"`
	Code       string          `json:"code"`
	Detail     string          `json:"detail"`
}

// agentStreamError captures the agent's terminal error packet (code +
// friendly content) so the stream can finalize the turn as errored without
// polluting the assistant message content with raw error text.
type agentStreamError struct {
	Code    string
	Content string
}

type streamContent struct {
	mu               sync.RWMutex
	content          strings.Builder
	thinking         strings.Builder
	toolCalls        []ToolCallCapture
	toolResults      []ToolCallResult
	completionTokens int
	isComplete       bool
	streamErr        *agentStreamError
}

// applyPacket records one decoded agent SSE packet into the accumulator.
func (sc *streamContent) applyPacket(packet AgentSSEPacket) {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	switch packet.Type {
	case "content":
		sc.content.WriteString(packet.Content)
	case "reasoning":
		sc.thinking.WriteString(packet.Content)
	case "tool_call":
		sc.toolCalls = append(sc.toolCalls, ToolCallCapture{
			ToolName:  packet.ToolName,
			ToolInput: packet.ToolInput,
		})
	case "tool_result":
		sc.toolResults = append(sc.toolResults, ToolCallResult{
			ToolName: packet.ToolName,
			Content:  packet.Content,
		})
	case "error":
		if packet.Code != "" || packet.Content != "" {
			sc.streamErr = &agentStreamError{Code: packet.Code, Content: packet.Content}
		}
	case "usage":
		if packet.Usage != nil && packet.Usage.CompletionTokens > 0 {
			sc.completionTokens = packet.Usage.CompletionTokens
		}
	case "turn_complete":
		sc.isComplete = true
	}
}

// finalStatus decides the terminal turn status once the stream ends: a
// provider failure reported by the agent wins over completion, and a stream
// that ended without a terminal packet is interrupted.
func (sc *streamContent) finalStatus() string {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	if sc.streamErr != nil {
		return domainconst.StatusError
	}
	if sc.isComplete {
		return domainconst.StatusComplete
	}
	return domainconst.StatusInterrupted
}

// streamAgentResponse relays the agent's SSE stream to the client while
// accumulating content, tool calls and usage for the final turn write. Runs
// inside SendStreamWriter after the agent response headers were set. The
// periodic flush persists partial content during the stream; the final
// content, steps and token count are written by finalizeTurn at the end.
func (h *Handler) streamAgentResponse(w *bufio.Writer, resp *http.Response, sessionID string, assistantMsgID int64, nextTurn int, redisLockToken string) {
	reader := bufio.NewReader(resp.Body)
	defer func() { _ = resp.Body.Close() }()

	sc := &streamContent{}

	flushCtx, flushCancel := context.WithCancel(context.Background())
	defer flushCancel()
	flushDone := make(chan struct{})

	go func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Error(msgconst.ErrChatFlushGoroutinePanic, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeyPanic, fmt.Sprintf("%v", r), msgconst.KeyStack, string(debug.Stack()))
			}
		}()
		defer close(flushDone)
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-flushCtx.Done():
				return
			case <-ticker.C:
				renewRedisSessionLock(context.Background(), h.RedisClient, sessionID, redisLockToken)
				sc.mu.RLock()
				content := sc.content.String()
				completionTokens := sc.completionTokens
				sc.mu.RUnlock()
				if content == "" {
					continue
				}
				err := retryDBOperation(3, 50*time.Millisecond, func() error {
					dbCtx, dbCancel := context.WithTimeout(context.Background(), 3*time.Second)
					defer dbCancel()
					return h.SessionRepo.UpdateMessageContent(dbCtx, assistantMsgID, content, nil, completionTokens)
				})
				if err != nil {
					slog.Error(msgconst.ErrChatFlushAfterRetries, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeyMsgID, assistantMsgID, msgconst.KeyErr, err)
				}
			}
		}
	}()

	buildStepsJSON := func(thinking string, calls []ToolCallCapture, results []ToolCallResult) json.RawMessage {
		var steps []agentmodel.ThoughtStep
		if thinking != "" {
			steps = append(steps, agentmodel.ThoughtStep{Type: "reasoning", Content: thinking})
		}
		for _, tc := range calls {
			steps = append(steps, agentmodel.ThoughtStep{Type: "tool_call", ToolName: tc.ToolName, ToolInput: tc.ToolInput})
		}
		for _, tr := range results {
			steps = append(steps, agentmodel.ThoughtStep{Type: "tool_result", ToolName: tr.ToolName, Content: tr.Content})
		}
		if len(steps) == 0 {
			return nil
		}
		b, _ := json.Marshal(steps)
		return b
	}

	for {
		line, rErr := reader.ReadBytes('\n')
		if len(line) > 0 {
			if _, wErr := w.Write(line); wErr != nil {
				slog.Error(msgconst.ErrChatClientWrite, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, sessionID, msgconst.KeyErr, wErr)
				break
			}
			if err := w.Flush(); err != nil {
				slog.Error(msgconst.ErrChatClientFlush, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, sessionID, msgconst.KeyErr, err)
				break
			}

			lineStr := string(line)
			if strings.HasPrefix(lineStr, "data: ") {
				dataStr := strings.TrimPrefix(lineStr, "data: ")
				dataStr = strings.TrimSpace(dataStr)

				var packet AgentSSEPacket
				if err := json.Unmarshal([]byte(dataStr), &packet); err == nil {
					sc.applyPacket(packet)
				}
			}
		}
		if rErr != nil {
			if rErr != io.EOF {
				slog.Error(msgconst.ErrChatAgentStreamAborted, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, sessionID, msgconst.KeyErr, rErr)
			}
			break
		}
	}

	flushCancel()

	select {
	case <-flushDone:
	case <-time.After(10 * time.Second):
		slog.Warn(msgconst.WarnChatFlushGoroutineLeft, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeyMsgID, assistantMsgID)
	}

	sc.mu.RLock()
	finalContent := sc.content.String()
	finalThinking := sc.thinking.String()
	finalCalls := sc.toolCalls
	finalResults := sc.toolResults
	streamErr := sc.streamErr
	sc.mu.RUnlock()

	status := sc.finalStatus()

	if streamErr != nil {
		slog.Error(msgconst.ErrChatAgentStreamError, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, sessionID, msgconst.KeyErrorCode, streamErr.Code, msgconst.KeyContent, streamErr.Content)
	}

	steps := buildStepsJSON(finalThinking, finalCalls, finalResults)

	assistantTokens := sc.completionTokens
	if assistantTokens == 0 {
		assistantTokens = h.countTokensViaAgent(context.Background(), finalContent)
	}

	if err := h.finalizeTurn(assistantMsgID, sessionID, finalContent, steps, assistantTokens, status); err != nil {
		slog.Error(msgconst.ErrChatFinalizeTurn, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeyMsgID, assistantMsgID, msgconst.KeyErr, err)
	}

	slog.Info(msgconst.InfoChatTurnCompleted, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeyTurn, nextTurn, msgconst.KeySessionID, sessionID, msgconst.KeyStatus, status, msgconst.KeyContentLen, len(finalContent))
}

// finalizeTurn persists the assistant message's final state once a turn ends.
// Called on every path after PrepareTurn - including agent request failures -
// so the streaming placeholder is never left stuck in 'streaming'.
func (h *Handler) finalizeTurn(assistantMsgID int64, sessionID, content string, steps json.RawMessage, tokenCount int, status string) error {
	err := retryDBOperation(3, 100*time.Millisecond, func() error {
		dbCtx, dbCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer dbCancel()
		return h.SessionRepo.CompleteTurn(dbCtx, assistantMsgID, sessionID, content, steps, tokenCount, status)
	})
	if err != nil {
		return fmt.Errorf("complete turn for msg %d: %w", assistantMsgID, err)
	}
	return nil
}
