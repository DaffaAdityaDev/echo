package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	agentmodel "echo-backend/internal/models/agent"
)

// Mission-stream packet shapes. These mirror the live-path packet structs in
// handler.go so the recovery relay can rebuild the same message fields.
type streamToolCallResult struct {
	ToolName string
	Content  string
}

type streamToolCallCapture struct {
	ToolName  string
	ToolInput json.RawMessage
}

type streamAgentUsage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
	TotalTokens      int `json:"totalTokens"`
}

type streamAgentSSEPacket struct {
	Type      string            `json:"type"`
	Content   string            `json:"content"`
	ToolName  string            `json:"toolName"`
	ToolInput json.RawMessage   `json:"toolInput"`
	Usage     *streamAgentUsage `json:"usage"`
}

// replayAccumulator rebuilds an assistant message's final content, reasoning,
// tool steps and token count from replayed mission-stream packets — the
// recovery-path equivalent of the live-path capture in HandleChat.
type replayAccumulator struct {
	content          strings.Builder
	thinking         strings.Builder
	toolCalls        []streamToolCallCapture
	toolResults      []streamToolCallResult
	completionTokens int
}

func (a *replayAccumulator) onPacket(raw string) {
	var packet streamAgentSSEPacket
	if err := json.Unmarshal([]byte(raw), &packet); err != nil {
		return
	}
	switch packet.Type {
	case "content":
		a.content.WriteString(packet.Content)
	case "reasoning":
		a.thinking.WriteString(packet.Content)
	case "tool_call":
		a.toolCalls = append(a.toolCalls, streamToolCallCapture{ToolName: packet.ToolName, ToolInput: packet.ToolInput})
	case "tool_result":
		a.toolResults = append(a.toolResults, streamToolCallResult{ToolName: packet.ToolName, Content: packet.Content})
	case "error":
		if packet.Content != "" {
			a.content.WriteString(packet.Content)
		}
	case "usage":
		if packet.Usage != nil && packet.Usage.CompletionTokens > 0 {
			a.completionTokens = packet.Usage.CompletionTokens
		}
	}
}

func (a *replayAccumulator) stepsJSON() json.RawMessage {
	var steps []agentmodel.ThoughtStep
	if a.thinking.Len() > 0 {
		steps = append(steps, agentmodel.ThoughtStep{Type: "reasoning", Content: a.thinking.String()})
	}
	for _, tc := range a.toolCalls {
		steps = append(steps, agentmodel.ThoughtStep{Type: "tool_call", ToolName: tc.ToolName, ToolInput: tc.ToolInput})
	}
	for _, tr := range a.toolResults {
		steps = append(steps, agentmodel.ThoughtStep{Type: "tool_result", ToolName: tr.ToolName, Content: tr.Content})
	}
	if len(steps) == 0 {
		return nil
	}
	b, _ := json.Marshal(steps)
	return b
}

// scanMissionStream reduces raw mission-stream entries into the accumulator,
// whether a terminal was present, and whether it was a clean completion. The
// terminal packet itself is not accumulated — it carries no content.
func scanMissionStream(entries []redis.XMessage) (*replayAccumulator, bool, bool) {
	acc := &replayAccumulator{}
	completed := false
	terminalSeen := false
	for _, entry := range entries {
		raw, ok := entry.Values["p"].(string)
		if !ok {
			continue
		}
		if t := terminalType(raw); t != "" {
			terminalSeen = true
			if t == "mission_completed" {
				completed = true
			} else {
				// An error terminal may carry a message; append it so the
				// persisted content matches the live-path behaviour.
				acc.onPacket(raw)
			}
			continue
		}
		acc.onPacket(raw)
	}
	return acc, completed, terminalSeen
}

// persistRecoveredMission finalizes the session's latest streaming/interrupted
// assistant message from the FULL mission stream (independent of the client's
// replay cursor). A mission that finished while its SSE connection was dropped
// otherwise stays "interrupted" forever, since the recovery relay writes
// nothing to the DB. Returns whether a terminal packet was present.
func (h *Handler) persistRecoveredMission(ctx context.Context, missionID string) (bool, error) {
	entries, err := h.RedisClient.XRange(ctx, fmt.Sprintf("mission:events:%s", missionID), "-", "+").Result()
	if err != nil {
		return false, err
	}

	acc, completed, terminalSeen := scanMissionStream(entries)
	if !terminalSeen {
		return false, nil
	}

	status := "interrupted"
	if completed {
		status = "complete"
	}

	assistantMsgID, err := h.SessionRepo.GetLatestAssistantMessageID(ctx, missionID)
	if err != nil {
		return true, err
	}
	if assistantMsgID == 0 {
		return true, nil
	}

	dbCtx, dbCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer dbCancel()
	if err := h.SessionRepo.CompleteTurn(dbCtx, assistantMsgID, missionID, acc.content.String(), acc.stepsJSON(), acc.completionTokens, status); err != nil {
		return true, err
	}
	log.Printf("[MISSION] Recovered mission %s persisted (status=%s, content_len=%d)", missionID, status, acc.content.Len())
	return true, nil
}

// terminalType returns the packet type if raw is a terminal packet, else "".
func terminalType(raw string) string {
	var p struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal([]byte(raw), &p); err != nil {
		return ""
	}
	if p.Type == "mission_completed" || p.Type == "error" {
		return p.Type
	}
	return ""
}
