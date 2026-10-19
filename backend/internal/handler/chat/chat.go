package chat

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	domainconst "echo-backend/internal/constants/domain"
	httpxconst "echo-backend/internal/constants/httpx"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/middleware"

	"github.com/gofiber/fiber/v3"
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
// @Failure 502 {object} map[string]string
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

	// Every session-scoped resource acquired below is released by cleanup.
	// Until streaming starts the handler owns it; afterwards the stream
	// writer does, since fasthttp runs the writer on a goroutine that
	// outlives this handler.
	cleanup := &turnCleanup{}
	streaming := false
	defer func() {
		if !streaming {
			cleanup.run()
		}
	}()

	// The per-session lock is held from here to the end of the streamed turn
	// (consolidation, history build, turn prep and the agent run included).
	cleanup.add(acquireSessionLock(req.SessionID))

	// Cross-process counterpart: serializes turns on the same session across
	// gateway instances when Redis is present. No-op unlock when unavailable.
	redisLockToken, releaseRedisLock, err := acquireRedisSessionLock(ctx, h.RedisClient, req.SessionID)
	if err != nil {
		slog.Warn(msgconst.WarnChatLockUnavailable, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, req.SessionID, msgconst.KeyErr, err)
	}
	cleanup.add(releaseRedisLock)

	currentSession, resolvedStrategyVersion, err := h.prepareTurnState(ctx, c, userID, req, currentSession, currentPinnedVersion, providerMap)
	if err != nil {
		return err
	}

	history, nextTurn, assistantMsgID, err := h.prepareChatTurn(ctx, c, req.SessionID, currentSession, req.Message, userTokenCount)
	if err != nil {
		return err
	}

	tenantID := middleware.TenantID(c)
	promptTemplateName, err := h.SettingsSvc.ResolvePromptTemplateNameForTenant(ctx, tenantID)
	if err != nil {
		slog.Warn(msgconst.WarnChatResolvePromptTmpl, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeyErr, err)
	}

	payload := buildChatAgentPayload(payloadArgs{
		userID:             strconv.Itoa(userID),
		message:            req.Message,
		model:              modelID,
		history:            history,
		providerConfig:     providerMap,
		strategyVersion:    resolvedStrategyVersion,
		sessionID:          req.SessionID,
		features:           features,
		skills:             skills,
		config:             config,
		tenantID:           tenantID,
		promptTemplateName: promptTemplateName,
	})
	slog.Info(msgconst.InfoChatTurnStarted, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeyTenantID, tenantID, msgconst.KeyPromptTemplate, payload["prompt_template"], msgconst.KeyFeatures, payload["features"])

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		slog.Error(msgconst.ErrChatMarshalAgentPayload, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, req.SessionID, msgconst.KeyErr, err)
		return h.failTurn(c, assistantMsgID, req.SessionID, fiber.StatusInternalServerError, "Failed to build agent request", httpxconst.EmptyDetails)
	}

	// Register the in-flight run up front so a cancel request arriving during
	// the agent request window still interrupts the mission (the watcher aborts
	// the in-flight agent request via cancelAgentReq).
	run := &activeRun{cancelCh: make(chan struct{})}
	registerActiveRun(req.SessionID, run)
	cleanup.add(func() { unregisterActiveRun(req.SessionID, run) })

	// The agent request must stay alive until the streamed response has been
	// fully relayed, so it is cancelled by cleanup rather than on return.
	agentReqCtx, cancelAgentReq := context.WithCancel(ctx)
	cleanup.add(cancelAgentReq)

	interruptStop := make(chan struct{})
	cleanup.add(func() { close(interruptStop) })
	go h.watchForInterrupt(run, interruptStop, req.SessionID, cancelAgentReq)

	agentReq, err := h.newAgentMissionRequest(agentReqCtx, mode, jsonPayload)
	if err != nil {
		slog.Error(msgconst.ErrChatCreateAgentRequest, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, req.SessionID, msgconst.KeyErr, err)
		return h.failTurn(c, assistantMsgID, req.SessionID, fiber.StatusInternalServerError, "Failed to create request to agent", httpxconst.EmptyDetails)
	}

	resp, err := handlerutil.HttpClient.Do(agentReq)
	if err != nil {
		slog.Error(msgconst.ErrChatAgentServiceDown, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, req.SessionID, msgconst.KeyErr, err)
		return h.failTurn(c, assistantMsgID, req.SessionID, fiber.StatusBadGateway, "Agent service unreachable", httpxconst.EmptyDetails)
	}
	run.setBody(resp)

	if resp.StatusCode != http.StatusOK {
		detail, readErr := readUpstreamError(resp)
		if readErr != nil {
			slog.Error(msgconst.ErrChatReadAgentErrorResp, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, req.SessionID, msgconst.KeyErr, readErr)
		}
		return h.failTurn(c, assistantMsgID, req.SessionID, upstreamFailureStatus(resp.StatusCode), "Agent request failed", detail)
	}

	c.Response().Header.Set(httpxconst.HeaderSessionID, req.SessionID)
	setSSEHeaders(c)

	streaming = true
	return c.SendStreamWriter(func(w *bufio.Writer) {
		defer cleanup.run()
		h.streamAgentResponse(w, resp, req.SessionID, assistantMsgID, nextTurn, redisLockToken)
	})
}

// newAgentMissionRequest builds the outbound mission request, forwarding the
// caller's trace context when one was supplied.
func (h *Handler) newAgentMissionRequest(ctx context.Context, mode string, jsonPayload []byte) (*http.Request, error) {
	agentReq, err := http.NewRequestWithContext(ctx, http.MethodPost, agentMissionURL(h.Cfg.AgentHTTPURL, mode), bytes.NewReader(jsonPayload))
	if err != nil {
		return nil, err
	}
	agentReq.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
	agentReq.Header.Set(httpxconst.HeaderXInternalToken, h.Cfg.InternalAuthToken)
	if traceparent, ok := agentTraceparent(ctx); ok {
		agentReq.Header.Set(httpxconst.HeaderTraceparent, traceparent)
	}
	return agentReq, nil
}

// failTurn finalizes the prepared turn as interrupted and responds with the
// given error, so the streaming placeholder never stays stuck in 'streaming'.
func (h *Handler) failTurn(c fiber.Ctx, assistantMsgID int64, sessionID string, status int, msg, detail string) error {
	if err := h.finalizeTurn(assistantMsgID, sessionID, "", nil, 0, domainconst.StatusInterrupted); err != nil {
		slog.Error(msgconst.ErrChatFinalizeInterrupted, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, sessionID, msgconst.KeyErr, err)
	}
	return handlerutil.RespondErrorDetail(c, status, msg, detail)
}

func setSSEHeaders(c fiber.Ctx) {
	c.Response().Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeEventStream)
	c.Response().Header.Set("Cache-Control", "no-cache, no-transform")
	c.Response().Header.Set("Connection", "keep-alive")
	c.Response().Header.Set("Transfer-Encoding", "chunked")
	c.Response().Header.Set("X-Accel-Buffering", "no")
}
