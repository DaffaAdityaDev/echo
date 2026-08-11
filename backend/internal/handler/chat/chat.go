package chat

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"echo-backend/internal/constants/db"
	"echo-backend/internal/handler/handlerutil"
	agentmodel "echo-backend/internal/models/agent"
	chatmodel "echo-backend/internal/models/chat"

	featuresvc "echo-backend/internal/service/features"

	"github.com/gofiber/fiber/v3"
	"go.opentelemetry.io/otel/trace"
)

// HandleChat godoc
// @Summary Send a chat message
// @Description Forwards a user message to the agent and streams the agent's progress as Server-Sent Events (SSE).
// @Description The stream starts with an X-Session-ID response header set to the session ID (new or existing).
// @Description Each line is `data: <json>` where the JSON is a StreamPacket: { "type": "...", "missionId": "...", "step": number, "seq": number, "timestamp": number }.
// @Description Packet types: metadata, reasoning, content, tool_call, tool_result, tool_skip, todo, subagent_call, subagent_result, usage, progress, heartbeat, state_change, degraded, turn_complete, debug, error, system_notice, token_metrics, hitl_approval_required, mission_completed.
// @Description Terminal packets: turn_complete, mission_completed, error.
// @Description If the connection drops mid-run, the mission is cancelled (token safety) and the turn is finalized as interrupted — send a new message to continue.
// @Description See docs/shared/contracts/json-api-contract.md §SSE Event Format for the full schema.
// @Tags Chat
// @Accept json
// @Produce text/event-stream
// @Security BearerAuth
// @Param request body ChatRequest true "Chat payload"
// @Success 200 {string} string "SSE stream of StreamPacket JSON lines (text/event-stream)"
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/chat [post]
func (h *Handler) HandleChat(c fiber.Ctx) error {
	var req ChatRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request")
	}

	ctx := c.Context()
	tpHeader := c.Get("traceparent")
	if sc, ok := parseTraceparent(tpHeader); ok {
		ctx = trace.ContextWithRemoteSpanContext(ctx, sc)
	}

	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	userTier := c.Get("X-User-Tier")
	if userTier == "" {
		userTier = "pro"
	}

	prefs, err := h.SettingsSvc.GetSettings(ctx, userID)
	if err != nil {
		log.Printf("[CHAT] Failed to load settings for user %d, falling back to defaults: %v", userID, err)
		prefs = h.SettingsSvc.GetDefaults()
	}

	modelID := prefs.DefaultModel
	if modelID == "" {
		modelID = h.Cfg.DefaultModel
	}
	mode := prefs.DefaultMode
	if mode == "" {
		mode = "standard"
	}
	if req.Model != "" {
		modelID = req.Model
	}
	if req.Mode != "" {
		mode = req.Mode
	}
	features := prefs.DefaultFeatures
	skills := prefs.DefaultSkills
	var config map[string]interface{}
	if prefs.HarnessToggles != nil {
		config = map[string]interface{}{"featureToggles": prefs.HarnessToggles}
	}

	if err := h.FeaturesSvc.ValidateRequest(ctx, features, userTier); err != nil {
		var unknownErr featuresvc.ErrUnknownFeature
		if errors.As(err, &unknownErr) {
			return handlerutil.RespondError(c, fiber.StatusBadRequest, unknownErr.Error())
		}
		var lockedErr featuresvc.ErrFeatureLocked
		if errors.As(err, &lockedErr) {
			return handlerutil.RespondError(c, fiber.StatusForbidden, lockedErr.Error())
		}
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Feature validation failed")
	}

	providerCfg, err := h.ModelSvc.ResolveProviderConfig(userID, modelID)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, fmt.Sprintf("Provider config error: %s", err.Error()))
	}

	providerMap := map[string]interface{}{
		"type":     providerCfg.Type,
		"base_url": providerCfg.BaseURL,
		"model":    providerCfg.Model,
	}
	if providerCfg.APIKey != "" {
		providerMap["api_key"] = providerCfg.APIKey
	}

	// Token counting is an HTTP round-trip to the agent; it must not hold the
	// session lock, which would serialize every message in the session on it.
	userTokenCount := h.countTokensViaAgent(c.Context(), req.Message)

	if len(skills) > 0 {
		skillsCatalog, err := h.GetSkills(ctx)
		if err == nil {
			skillMap := make(map[string]bool)
			for _, s := range skillsCatalog {
				if name, ok := s["name"].(string); ok {
					skillMap[name] = true
				}
			}
			for _, skillName := range skills {
				if !skillMap[skillName] {
					return handlerutil.RespondError(c, fiber.StatusBadRequest, fmt.Sprintf("Unknown skill '%s'", skillName))
				}
			}
		}
	}

	var currentSession *chatmodel.Session
	var currentPinnedVersion string

	if req.SessionID != "" {
		sess, err := h.SessionRepo.GetByID(ctx, req.SessionID)
		if err != nil {
			return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to load session", err.Error())
		}
		if sess == nil || sess.Status == "deleted" {
			return handlerutil.RespondError(c, fiber.StatusNotFound, "Session not found")
		}
		if sess.UserID != userID {
			return handlerutil.RespondError(c, fiber.StatusForbidden, "Forbidden: ownership mismatch")
		}
		currentSession = sess
		currentPinnedVersion = sess.StrategyVersion
	} else {
		resolvedVersion, err := h.StrategySvc.ResolveVersion(ctx, "", "", userID)
		if err != nil {
			return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid or deprecated strategy version requested")
		}
		createdSess, err := h.SessionRepo.CreateSession(ctx, userID, db.DefaultSessionTitle, resolvedVersion)
		if err != nil {
			return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to create session")
		}
		currentSession = createdSess
		req.SessionID = currentSession.ID
		currentPinnedVersion = currentSession.StrategyVersion
	}

	// The per-session lock is held from here to the end of the streamed turn
	// (consolidation, history build, turn prep and the agent run included).
	unlock := acquireSessionLock(req.SessionID)
	defer unlock()

	// Cross-process counterpart: serializes turns on the same session across
	// gateway instances when Redis is present. No-op unlock when unavailable.
	redisLockToken, releaseRedisLock, err := acquireRedisSessionLock(ctx, h.RedisClient, req.SessionID)
	if err != nil {
		log.Printf("[CHAT] Distributed session lock unavailable for %s: %v", req.SessionID, err)
	}
	defer releaseRedisLock()

	// Consolidation must run under the lock: two rapid turns could otherwise
	// both cross the token threshold and compact the same session twice, and
	// a concurrent turn would build history from a stale context summary.
	if req.SessionID != "" {
		isThresholdCrossed, err := h.ConsolidationSvc.CheckThreshold(ctx, req.SessionID)
		if err == nil && isThresholdCrossed {
			log.Printf("[CONSOLIDATION] Token threshold reached. Compacting session %s...", req.SessionID)
			err = h.ConsolidationSvc.TriggerConsolidation(ctx, req.SessionID, providerMap)
			if err != nil {
				log.Printf("[CONSOLIDATION] Error during auto-consolidation: %v", err)
			} else {
				currentSession, _ = h.SessionRepo.GetByID(ctx, req.SessionID)
			}
		}
	}

	resolvedStrategyVersion := currentPinnedVersion
	if resolvedStrategyVersion == "" {
		resolvedStrategyVersion, err = h.StrategySvc.ResolveVersion(ctx, "", "", userID)
		if err != nil {
			return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid or deprecated strategy version requested")
		}
	}
	if currentPinnedVersion == "" {
		_ = h.SessionRepo.PinStrategyVersion(ctx, req.SessionID, resolvedStrategyVersion)
	}
	_ = h.SessionRepo.TouchSession(ctx, req.SessionID)

	dbMessages, err := h.buildCappedHistory(ctx, req.SessionID)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to load session history", err.Error())
	}

	var history []HistoryMessage
	if currentSession != nil && currentSession.ContextSummary != "" {
		history = append(history, HistoryMessage{
			Role:    "system",
			Content: fmt.Sprintf("Context summary of consolidated previous turns:\n%s", currentSession.ContextSummary),
		})
	}

	for _, dbMsg := range dbMessages {
		if dbMsg.Role == "thought" || dbMsg.Role == "tool_call" || dbMsg.Role == "tool_result" {
			continue
		}
		history = append(history, HistoryMessage{
			Role:    dbMsg.Role,
			Content: dbMsg.Content,
		})
	}

	maxTurn, err := h.SessionRepo.GetMaxTurnNumber(ctx, req.SessionID)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to compute next turn", err.Error())
	}
	nextTurn := maxTurn + 1

	assistantMsgID, err := h.SessionRepo.PrepareTurn(ctx, req.SessionID, req.Message, userTokenCount, nextTurn)
	if err != nil {
		log.Printf("[CHAT] Failed to prepare turn for session %s: %v", req.SessionID, err)
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to prepare chat turn", err.Error())
	}

	agentURL := fmt.Sprintf("%s/api/generate-mission?mode=%s", h.Cfg.AgentHTTPURL, mode)

	sessionIDToUse := req.SessionID

	tenantID := c.Get("X-Tenant-ID", "local")
	promptTemplateName, err := h.SettingsSvc.ResolvePromptTemplateNameForTenant(ctx, tenantID)
	if err != nil {
		log.Printf("[CHAT] Failed to resolve prompt template name: %v", err)
	}

	payload := buildChatAgentPayload(payloadArgs{
		userID:             strconv.Itoa(userID),
		message:            req.Message,
		model:              modelID,
		history:            history,
		providerConfig:     providerMap,
		strategyVersion:    resolvedStrategyVersion,
		sessionID:          sessionIDToUse,
		features:           features,
		skills:             skills,
		config:             config,
		tenantID:           tenantID,
		promptTemplateName: promptTemplateName,
	})
	log.Printf("[CHAT] tenant=%s prompt_template=%q features=%v", tenantID, payload["prompt_template"], payload["features"])

	jsonPayload, _ := json.Marshal(payload)

	// Register the in-flight run up front so a cancel request arriving during
	// the agent request window still interrupts the mission (the watcher aborts
	// the in-flight agent request via cancelAgentReq).
	run := &activeRun{cancelCh: make(chan struct{})}
	activeRunsMu.Lock()
	activeRuns[req.SessionID] = run
	activeRunsMu.Unlock()
	defer func() {
		activeRunsMu.Lock()
		delete(activeRuns, req.SessionID)
		activeRunsMu.Unlock()
	}()

	agentReqCtx, cancelAgentReq := context.WithCancel(ctx)
	defer cancelAgentReq()

	// Watcher for an explicit interrupt (POST /sessions/:id/cancel closes
	// run.cancelCh). The agent cancel endpoint is the fast path (it aborts the
	// in-flight LLM stream); cancelling the agent request context covers the
	// window where the agent has not started streaming yet; closing the agent
	// connection afterwards guarantees the agent's onAbort fires even if the
	// cancel call failed.
	interruptStop := make(chan struct{})
	defer close(interruptStop)
	go func() {
		select {
		case <-run.cancelCh:
			log.Printf("[CHAT] Interrupt requested for session %s; notifying agent", req.SessionID)
			cancelAgentReq()
			// Guard against stale interrupts: if a new turn has already claimed
			// the session (user stopped then immediately sent a new message),
			// the old watcher must not abort the new turn's mission.
			activeRunsMu.Lock()
			stillCurrent := activeRuns[req.SessionID] == run
			activeRunsMu.Unlock()
			if stillCurrent {
				agentCtx, agentCancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer agentCancel()
				if err := cancelAgentMission(agentCtx, h.Cfg, req.SessionID); err != nil {
					log.Printf("[CHAT] Agent cancel call failed for session %s: %v", req.SessionID, err)
				}
			} else {
				log.Printf("[CHAT] Stale interrupt for session %s (new turn active); skipping agent cancel", req.SessionID)
			}
			run.closeBody()
		case <-interruptStop:
		}
	}()

	agentReq, err := http.NewRequestWithContext(agentReqCtx, "POST", agentURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to create request to agent")
	}
	agentReq.Header.Set("Content-Type", "application/json")
	agentReq.Header.Set("X-Internal-Token", h.Cfg.InternalAuthToken)

	newTraceContext := trace.SpanContextFromContext(ctx)
	agentTraceparent := fmt.Sprintf("00-%s-%s-01", newTraceContext.TraceID().String(), newTraceContext.SpanID().String())
	agentReq.Header.Set("traceparent", agentTraceparent)

	resp, err := handlerutil.HttpClient.Do(agentReq)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Agent service unreachable")
	}
	run.setBody(resp)

	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		bodyBytes, _ := io.ReadAll(resp.Body)
		return handlerutil.RespondErrorDetail(c, resp.StatusCode, "Agent request failed", string(bodyBytes))
	}

	c.Response().Header.Set("X-Session-ID", req.SessionID)
	c.Response().Header.Set("Content-Type", "text/event-stream")
	c.Response().Header.Set("Cache-Control", "no-cache, no-transform")
	c.Response().Header.Set("Connection", "keep-alive")
	c.Response().Header.Set("Transfer-Encoding", "chunked")
	c.Response().Header.Set("X-Accel-Buffering", "no")

	return c.SendStreamWriter(func(w *bufio.Writer) {
		reader := bufio.NewReader(resp.Body)
		defer resp.Body.Close()

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
		}

		type streamContent struct {
			mu               sync.RWMutex
			content          strings.Builder
			thinking         strings.Builder
			toolCalls        []ToolCallCapture
			toolResults      []ToolCallResult
			completionTokens int
			isComplete       bool
		}

		sc := &streamContent{}

		flushCtx, flushCancel := context.WithCancel(context.Background())
		defer flushCancel()
		flushDone := make(chan struct{})

		go func() {
			defer close(flushDone)
			ticker := time.NewTicker(2 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-flushCtx.Done():
					return
				case <-ticker.C:
					renewRedisSessionLock(context.Background(), h.RedisClient, req.SessionID, redisLockToken)
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
						log.Printf("[CHAT] Flush error msg %d (after retries): %v", assistantMsgID, err)
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
					break
				}
				if err := w.Flush(); err != nil {
					break
				}

				lineStr := string(line)
				if strings.HasPrefix(lineStr, "data: ") {
					dataStr := strings.TrimPrefix(lineStr, "data: ")
					dataStr = strings.TrimSpace(dataStr)

					var packet AgentSSEPacket
					if err := json.Unmarshal([]byte(dataStr), &packet); err == nil {
						sc.mu.Lock()
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
							if packet.Content != "" {
								sc.content.WriteString(packet.Content)
							}
						case "usage":
							if packet.Usage != nil && packet.Usage.CompletionTokens > 0 {
								sc.completionTokens = packet.Usage.CompletionTokens
							}
						case "turn_complete":
							sc.isComplete = true
						}
						sc.mu.Unlock()
					}
				}
			}
			if rErr != nil {
				break
			}
		}

		flushCancel()

		select {
		case <-flushDone:
		case <-time.After(10 * time.Second):
			log.Printf("[CHAT] Flush goroutine did not exit for msg %d; proceeding to finalize", assistantMsgID)
		}

		sc.mu.RLock()
		finalContent := sc.content.String()
		finalThinking := sc.thinking.String()
		finalCalls := sc.toolCalls
		finalResults := sc.toolResults
		complete := sc.isComplete
		sc.mu.RUnlock()

		status := "interrupted"
		if complete {
			status = "complete"
		}

		steps := buildStepsJSON(finalThinking, finalCalls, finalResults)

		assistantTokens := sc.completionTokens
		if assistantTokens == 0 {
			assistantTokens = h.countTokensViaAgent(context.Background(), finalContent)
		}

		err = retryDBOperation(3, 100*time.Millisecond, func() error {
			dbCtx, dbCancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer dbCancel()
			return h.SessionRepo.CompleteTurn(dbCtx, assistantMsgID, req.SessionID, finalContent, steps, assistantTokens, status)
		})
		if err != nil {
			log.Printf("[CHAT] Error executing CompleteTurn transaction for msg %d: %v", assistantMsgID, err)
		}

		log.Printf("[CHAT] Completed turn %d for session %s (status=%s, content_len=%d)", nextTurn, req.SessionID, status, len(finalContent))
	})
}
