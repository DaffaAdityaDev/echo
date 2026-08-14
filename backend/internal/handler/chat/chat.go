package chat

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"

	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/middleware"

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
	req, err := parseChatRequest(c)
	if err != nil {
		return err
	}

	ctx := withRemoteTraceContext(c.Context(), c)

	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}
	userTier := middleware.UserTier(c)

	modelID, mode, features, skills, config, err := h.resolveTurnPreferences(ctx, c, userID, userTier, req)
	if err != nil {
		return err
	}

	providerCfg, err := h.ModelSvc.ResolveProviderConfig(ctx, userID, modelID)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, fmt.Sprintf("Provider config error: %s", err.Error()))
	}

	providerMap := map[string]interface{}{
		"type":               providerCfg.Type,
		"base_url":           providerCfg.BaseURL,
		"model":              providerCfg.Model,
		"max_context_tokens": providerCfg.MaxContextTokens,
	}
	if providerCfg.APIKey != "" {
		providerMap["api_key"] = providerCfg.APIKey
	}

	// Token counting is an HTTP round-trip to the agent; it must not hold the
	// session lock, which would serialize every message in the session on it.
	userTokenCount := h.countTokensViaAgent(c.Context(), req.Message)

	if err := h.validateRequestedSkills(ctx, c, skills); err != nil {
		return err
	}

	currentSession, currentPinnedVersion, err := h.resolveOrCreateSession(ctx, c, userID, req.SessionID)
	if err != nil {
		return err
	}
	req.SessionID = currentSession.ID

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

	currentSession, resolvedStrategyVersion, err := h.prepareTurnState(ctx, c, userID, req, currentSession, currentPinnedVersion, providerMap)
	if err != nil {
		return err
	}

	history, nextTurn, assistantMsgID, err := h.prepareChatTurn(ctx, c, req.SessionID, currentSession, req.Message, userTokenCount)
	if err != nil {
		return err
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

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[CHAT] Failed to marshal agent payload for session %s: %v", req.SessionID, err)
		if finalizeErr := h.finalizeTurn(assistantMsgID, req.SessionID, "", nil, 0, "interrupted"); finalizeErr != nil {
			log.Printf("[CHAT] Failed to finalize interrupted turn for session %s: %v", req.SessionID, finalizeErr)
		}
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to build agent request")
	}

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

	// The agent request must stay alive until the streamed response has been
	// fully relayed: SendStreamWriter registers a callback that fasthttp runs
	// only AFTER the handler returns, so cancelling agentReqCtx in a defer
	// here would abort the outbound agent request before the first packet is
	// forwarded. Cancel it when the stream actually ends instead.
	agentReqCtx, cancelAgentReq := context.WithCancel(ctx)

	interruptStop := make(chan struct{})
	defer close(interruptStop)
	go h.watchForInterrupt(run, interruptStop, req.SessionID, cancelAgentReq)

	agentReq, err := http.NewRequestWithContext(agentReqCtx, "POST", agentURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		log.Printf("[CHAT] Failed to create agent request for session %s: %v", req.SessionID, err)
		if finalizeErr := h.finalizeTurn(assistantMsgID, req.SessionID, "", nil, 0, "interrupted"); finalizeErr != nil {
			log.Printf("[CHAT] Failed to finalize interrupted turn for session %s: %v", req.SessionID, finalizeErr)
		}
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to create request to agent")
	}
	agentReq.Header.Set("Content-Type", "application/json")
	agentReq.Header.Set("X-Internal-Token", h.Cfg.InternalAuthToken)

	newTraceContext := trace.SpanContextFromContext(ctx)
	agentTraceparent := fmt.Sprintf("00-%s-%s-01", newTraceContext.TraceID().String(), newTraceContext.SpanID().String())
	agentReq.Header.Set("traceparent", agentTraceparent)

	resp, err := handlerutil.HttpClient.Do(agentReq)
	if err != nil {
		log.Printf("[CHAT] Agent service unreachable for session %s: %v", req.SessionID, err)
		if finalizeErr := h.finalizeTurn(assistantMsgID, req.SessionID, "", nil, 0, "interrupted"); finalizeErr != nil {
			log.Printf("[CHAT] Failed to finalize interrupted turn for session %s: %v", req.SessionID, finalizeErr)
		}
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Agent service unreachable")
	}
	run.setBody(resp)

	if resp.StatusCode != http.StatusOK {
		bodyBytes, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if readErr != nil {
			log.Printf("[CHAT] Failed to read agent error response for session %s: %v", req.SessionID, readErr)
		}
		if finalizeErr := h.finalizeTurn(assistantMsgID, req.SessionID, "", nil, 0, "interrupted"); finalizeErr != nil {
			log.Printf("[CHAT] Failed to finalize interrupted turn for session %s: %v", req.SessionID, finalizeErr)
		}
		return handlerutil.RespondErrorDetail(c, resp.StatusCode, "Agent request failed", string(bodyBytes))
	}

	c.Response().Header.Set("X-Session-ID", req.SessionID)
	c.Response().Header.Set("Content-Type", "text/event-stream")
	c.Response().Header.Set("Cache-Control", "no-cache, no-transform")
	c.Response().Header.Set("Connection", "keep-alive")
	c.Response().Header.Set("Transfer-Encoding", "chunked")
	c.Response().Header.Set("X-Accel-Buffering", "no")

	return c.SendStreamWriter(func(w *bufio.Writer) {
		h.streamAgentResponse(w, resp, req.SessionID, assistantMsgID, nextTurn, redisLockToken)
		cancelAgentReq()
	})
}
