package chat

import (
	"bufio"
	"bytes"
	"context"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/agent"
	chatmodel "echo-backend/internal/models/chat"
	"echo-backend/internal/models/config"

	"echo-backend/internal/repository/session"
	"echo-backend/internal/service/aimodel"
	"echo-backend/internal/service/consolidation"
	featuresvc "echo-backend/internal/service/features"
	stratSvc "echo-backend/internal/service/strategy"
	"encoding/json"
	"errors"

	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/otel/trace"
)

var sessionLocks sync.Map

func acquireSessionLock(sessionID string) func() {
	if sessionID == "" {
		return func() {}
	}
	actual, _ := sessionLocks.LoadOrStore(sessionID, &sync.Mutex{})
	mu := actual.(*sync.Mutex)
	mu.Lock()
	return func() { mu.Unlock() }
}

func retryDBOperation(attempts int, delay time.Duration, fn func() error) error {
	var err error
	for i := 0; i < attempts; i++ {
		err = fn()
		if err == nil {
			return nil
		}
		if i < attempts-1 {
			time.Sleep(delay * time.Duration(1<<i))
		}
	}
	return err
}

type Handler struct {
	Cfg              *cfgmodel.Config
	RedisClient      *redis.Client
	HonoAPIURL       string
	ModelSvc         *aimodel.Service
	SessionRepo      *session.Repository
	ConsolidationSvc *consolidation.Service
	StrategySvc      *stratSvc.Service
	FeaturesSvc      *featuresvc.Service
}

func NewHandler(
	cfg *cfgmodel.Config,
	rdb *redis.Client,
	modelSvc *aimodel.Service,
	sessionRepo *session.Repository,
	consolidationSvc *consolidation.Service,
	strategySvc *stratSvc.Service,
	featuresSvc *featuresvc.Service,
) *Handler {
	return &Handler{
		Cfg:              cfg,
		RedisClient:      rdb,
		HonoAPIURL:       cfg.AgentHTTPURL,
		ModelSvc:         modelSvc,
		SessionRepo:      sessionRepo,
		ConsolidationSvc: consolidationSvc,
		StrategySvc:      strategySvc,
		FeaturesSvc:      featuresSvc,
	}
}

type HistoryMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Message         string                 `json:"message"`
	Model           string                 `json:"model"`
	Mode            string                 `json:"mode"`
	StrategyVersion string                 `json:"strategyVersion,omitempty"`
	SessionID       string                 `json:"sessionId"`
	MissionID       string                 `json:"missionId"`
	History         []HistoryMessage       `json:"history"`
	Features        []string               `json:"features"`
	Skills          []string               `json:"skills"`
	Config          map[string]interface{} `json:"config,omitempty"`
}

func parseTraceparent(tp string) (trace.SpanContext, bool) {
	if !strings.HasPrefix(tp, "00-") {
		return trace.SpanContext{}, false
	}
	parts := strings.Split(tp, "-")
	if len(parts) < 3 {
		return trace.SpanContext{}, false
	}
	traceID, err := trace.TraceIDFromHex(parts[1])
	if err != nil {
		return trace.SpanContext{}, false
	}
	spanID, err := trace.SpanIDFromHex(parts[2])
	if err != nil {
		return trace.SpanContext{}, false
	}
	return trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    traceID,
		SpanID:     spanID,
		TraceFlags: trace.FlagsSampled,
		Remote:     true,
	}), true
}

// HandleChat godoc
// @Summary Send a chat message
// @Description Forwards a user message to the agent for processing
// @Tags Chat
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body ChatRequest true "Chat payload"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
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

	if err := h.FeaturesSvc.ValidateRequest(ctx, req.Features, userTier); err != nil {
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

	modelID := req.Model
	if modelID == "" {
		modelID = h.Cfg.DefaultModel
	}
	providerCfg, err := h.ModelSvc.ResolveProviderConfig(userID, modelID)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, fmt.Sprintf("Provider config error: %s", err.Error()))
	}

	if len(req.Skills) > 0 {
		skillsCatalog, err := h.GetSkills(ctx)
		if err == nil {
			skillMap := make(map[string]bool)
			for _, s := range skillsCatalog {
				if name, ok := s["name"].(string); ok {
					skillMap[name] = true
				}
			}
			for _, skillName := range req.Skills {
				if !skillMap[skillName] {
					return handlerutil.RespondError(c, fiber.StatusBadRequest, fmt.Sprintf("Unknown skill '%s'", skillName))
				}
			}
		}
	}

	providerMap := map[string]interface{}{
		"type":     providerCfg.Type,
		"base_url": providerCfg.BaseURL,
		"model":    providerCfg.Model,
	}
	if providerCfg.APIKey != "" {
		providerMap["api_key"] = providerCfg.APIKey
	}

	var history []HistoryMessage
	nextTurn := 1
	var currentSession *chatmodel.Session

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

		dbMessages, err := h.SessionRepo.GetSessionMessages(ctx, req.SessionID)
		if err != nil {
			return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to load session history", err.Error())
		}

		if currentSession != nil && currentSession.ContextSummary != "" {
			history = append(history, HistoryMessage{
				Role:    "system",
				Content: fmt.Sprintf("Context summary of consolidated previous turns:\n%s", currentSession.ContextSummary),
			})
		}

		for _, dbMsg := range dbMessages {
			if dbMsg.Role == "thought" || dbMsg.Role == "tool_call" || dbMsg.Role == "tool_result" {
				if dbMsg.TurnNumber >= nextTurn {
					nextTurn = dbMsg.TurnNumber + 1
				}
				continue
			}
			history = append(history, HistoryMessage{
				Role:    dbMsg.Role,
				Content: dbMsg.Content,
			})
			if dbMsg.TurnNumber >= nextTurn {
				nextTurn = dbMsg.TurnNumber + 1
			}
		}
	} else {
		history = req.History
	}

	var currentPinnedVersion string
	if currentSession != nil {
		currentPinnedVersion = currentSession.StrategyVersion
	}

	if req.SessionID == "" {
		resolvedVersion, err := h.StrategySvc.ResolveVersion(ctx, "", req.StrategyVersion, userID)
		if err != nil {
			return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid or deprecated strategy version requested")
		}
		createdSess, err := h.SessionRepo.CreateSession(ctx, userID, db.DefaultSessionTitle, resolvedVersion)
		if err != nil {
			return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to create session")
		}
		currentSession = createdSess
		req.SessionID = currentSession.ID
		req.MissionID = currentSession.ID
		currentPinnedVersion = currentSession.StrategyVersion
		nextTurn = 1
	}


	resolvedStrategyVersion, err := h.StrategySvc.ResolveVersion(ctx, currentPinnedVersion, req.StrategyVersion, userID)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid or deprecated strategy version requested")
	}
	if req.SessionID != "" && currentPinnedVersion == "" && resolvedStrategyVersion != "" {
		_ = h.SessionRepo.PinStrategyVersion(ctx, req.SessionID, resolvedStrategyVersion)
	}

	if req.SessionID != "" {
		_ = h.SessionRepo.TouchSession(ctx, req.SessionID)
	}

	unlock := acquireSessionLock(req.SessionID)
	defer unlock()

	userTokenCount := len(req.Message) / 4
	if userTokenCount == 0 && len(req.Message) > 0 {
		userTokenCount = 1
	}
	assistantMsgID, err := h.SessionRepo.PrepareTurn(ctx, req.SessionID, req.Message, userTokenCount, nextTurn)
	if err != nil {
		log.Printf("[CHAT] Failed to prepare turn for session %s: %v", req.SessionID, err)
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to prepare chat turn", err.Error())
	}

	agentURL := fmt.Sprintf("%s/api/generate-mission?mode=%s", h.Cfg.AgentHTTPURL, req.Mode)

	payload := map[string]interface{}{
		"user_id":          strconv.Itoa(userID),
		"message":          req.Message,
		"model":            req.Model,
		"history":          history,
		"provider_config":  providerMap,
		"strategy_version": resolvedStrategyVersion,
	}

	missionIDToUse := req.SessionID
	if missionIDToUse == "" {
		missionIDToUse = req.MissionID
	}
	if missionIDToUse != "" {
		payload["missionId"] = missionIDToUse
	}
	if req.Features == nil {
		payload["features"] = []string{}
	} else {
		payload["features"] = req.Features
	}
	if len(req.Skills) > 0 {
		payload["skills"] = req.Skills
	}
	if len(req.Config) > 0 {
		payload["config"] = req.Config
	}
	jsonPayload, _ := json.Marshal(payload)

	agentReq, err := http.NewRequestWithContext(ctx, "POST", agentURL, bytes.NewBuffer(jsonPayload))
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

	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		bodyBytes, _ := io.ReadAll(resp.Body)
		return handlerutil.RespondErrorDetail(c, resp.StatusCode, "Agent request failed", string(bodyBytes))
	}

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

		type AgentSSEPacket struct {
			Type       string          `json:"type"`
			Content    string          `json:"content"`
			Title      string          `json:"title"`
			Summary    string          `json:"summary"`
			ToolName   string          `json:"toolName"`
			ToolInput  json.RawMessage `json:"toolInput"`
			ToolResult string          `json:"toolResult"`
		}

		type streamContent struct {
			mu          sync.RWMutex
			content     strings.Builder
			thinking    strings.Builder
			toolCalls   []ToolCallCapture
			toolResults []ToolCallResult
			isComplete  bool
		}

		sc := &streamContent{}

		flushCtx, flushCancel := context.WithCancel(context.Background())
		defer flushCancel()

		go func() {
			ticker := time.NewTicker(2 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-flushCtx.Done():
					return
				case <-ticker.C:
					sc.mu.RLock()
					content := sc.content.String()
					sc.mu.RUnlock()
					if content == "" {
						continue
					}
					err := retryDBOperation(3, 50*time.Millisecond, func() error {
						dbCtx, dbCancel := context.WithTimeout(context.Background(), 3*time.Second)
						defer dbCancel()
						return h.SessionRepo.UpdateMessageContent(dbCtx, assistantMsgID, content, nil, len(content)/4)
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

		err = retryDBOperation(3, 100*time.Millisecond, func() error {
			dbCtx, dbCancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer dbCancel()
			return h.SessionRepo.CompleteTurn(dbCtx, assistantMsgID, req.SessionID, finalContent, steps, len(finalContent)/4, status)
		})
		if err != nil {
			log.Printf("[CHAT] Error executing CompleteTurn transaction for msg %d: %v", assistantMsgID, err)
		}

		log.Printf("[CHAT] Completed turn %d for session %s (status=%s, content_len=%d)", nextTurn, req.SessionID, status, len(finalContent))
	})
}

// StreamMissionLogs godoc
// @Summary Stream mission logs
// @Description Streams real-time mission execution logs as Server-Sent Events
// @Tags Chat
// @Produce text/event-stream
// @Security BearerAuth
// @Param missionId path string true "Mission ID"
// @Success 200 {string} string "Event stream"
// @Failure 400 {object} map[string]string
// @Router /api/v1/missions/{missionId}/stream [get]
func (h *Handler) StreamMissionLogs(c fiber.Ctx) error {
	missionID := c.Params("missionId")
	if missionID == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "missionId is required")
	}

	runtimeMode := os.Getenv("AGENT_RUNTIME_MODE")
	if runtimeMode == "" {
		runtimeMode = "local"
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache, no-transform")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")
	c.Set("X-Accel-Buffering", "no")

	if runtimeMode == "saas" {
		if h.RedisClient == nil {
			return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Redis state store is offline")
		}

		return c.SendStreamWriter(func(w *bufio.Writer) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			pubsub := h.RedisClient.Subscribe(ctx, fmt.Sprintf("stream:%s", missionID))
			defer pubsub.Close()

			ch := pubsub.Channel()

			ticker := time.NewTicker(15 * time.Second)
			defer ticker.Stop()

			for {
				select {
				case msg, open := <-ch:
					if !open {
						return
					}
					_, err := fmt.Fprintf(w, "data: %s\n\n", msg.Payload)
					if err != nil {
						return
					}
					if err := w.Flush(); err != nil {
						return
					}
				case <-ticker.C:
					_, err := fmt.Fprint(w, ": heartbeat\n\n")
					if err != nil {
						return
					}
					if err := w.Flush(); err != nil {
						return
					}
				case <-c.Context().Done():
					return
				}
			}
		})
	} else {
		honoStreamURL := fmt.Sprintf("%s/api/v1/missions/%s/stream", h.HonoAPIURL, missionID)

		return c.SendStreamWriter(func(w *bufio.Writer) {
			reqCtx, reqCancel := context.WithCancel(c.Context())
			defer reqCancel()

			req, err := http.NewRequestWithContext(reqCtx, "GET", honoStreamURL, nil)
			if err != nil {
				return
			}

			resp, err := handlerutil.HttpClient.Do(req)
			if err != nil {
				return
			}
			defer resp.Body.Close()

			reader := bufio.NewReader(resp.Body)

			for {
				line, err := reader.ReadBytes('\n')
				if err != nil {
					return
				}

				_, err = w.Write(line)
				if err != nil {
					return
				}

				if err := w.Flush(); err != nil {
					return
				}
			}
		})
	}
}

// HandleApproveTool godoc
// @Summary Approve a pending tool call
// @Description Approves a human-in-the-loop tool approval request for a mission
// @Tags Chat
// @Produce json
// @Security BearerAuth
// @Param id path string true "Mission ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /api/v1/missions/{id}/approve [post]
func (h *Handler) HandleApproveTool(c fiber.Ctx) error {
	return h.handleHitlAction(c, "approve")
}

// HandleDenyTool godoc
// @Summary Deny a pending tool call
// @Description Denies a human-in-the-loop tool approval request for a mission
// @Tags Chat
// @Produce json
// @Security BearerAuth
// @Param id path string true "Mission ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /api/v1/missions/{id}/deny [post]
func (h *Handler) HandleDenyTool(c fiber.Ctx) error {
	return h.handleHitlAction(c, "deny")
}

func (h *Handler) handleHitlAction(c fiber.Ctx, action string) error {
	missionID := c.Params("id")
	if missionID == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "mission ID required")
	}

	var body map[string]interface{}
	if err := c.Bind().JSON(&body); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	agentURL := fmt.Sprintf("%s/api/v1/missions/%s/%s", h.Cfg.AgentHTTPURL, missionID, action)
	jsonPayload, _ := json.Marshal(body)

	agentReq, err := http.NewRequestWithContext(c.Context(), "POST", agentURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to create request")
	}
	agentReq.Header.Set("Content-Type", "application/json")
	agentReq.Header.Set("X-Internal-Token", h.Cfg.InternalAuthToken)

	resp, err := handlerutil.HttpClient.Do(agentReq)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadGateway, "Agent unreachable")
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return handlerutil.RespondErrorDetail(c, resp.StatusCode, "Agent rejected", string(bodyBytes))
	}

	c.Response().Header.Set("Content-Type", "text/event-stream")
	c.Response().Header.Set("Cache-Control", "no-cache, no-transform")
	c.Response().Header.Set("Connection", "keep-alive")
	c.Response().Header.Set("Transfer-Encoding", "chunked")
	c.Response().Header.Set("X-Accel-Buffering", "no")

	return c.SendStreamWriter(func(w *bufio.Writer) {
		reader := bufio.NewReader(resp.Body)
		for {
			line, rErr := reader.ReadBytes('\n')
			if len(line) > 0 {
				if _, wErr := w.Write(line); wErr != nil {
					break
				}
				if err := w.Flush(); err != nil {
					break
				}
			}
			if rErr != nil {
				break
			}
		}
	})
}

func (h *Handler) GetSkills(ctx context.Context) ([]map[string]interface{}, error) {
	cacheKey := "agent:skills"

	if h.RedisClient != nil {
		cached, err := h.RedisClient.Get(ctx, cacheKey).Result()
		if err == nil && cached != "" {
			var skills []map[string]interface{}
			if err := json.Unmarshal([]byte(cached), &skills); err == nil {
				return skills, nil
			}
		}
	}

	agentURL := fmt.Sprintf("%s/api/skills", h.HonoAPIURL)
	req, err := http.NewRequestWithContext(ctx, "GET", agentURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Internal-Token", h.Cfg.InternalAuthToken)

	resp, err := handlerutil.HttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("agent skills request failed: status %d, details: %s", resp.StatusCode, string(bodyBytes))
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var skills []map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &skills); err != nil {
		return nil, err
	}

	if h.RedisClient != nil {
		if err := h.RedisClient.Set(ctx, cacheKey, string(bodyBytes), 10*time.Minute).Err(); err != nil {
			log.Printf("Failed to cache skills in Redis: %v", err)
		}
	}

	return skills, nil
}

// HandleGetSkills godoc
// @Summary List available agent skills
// @Description Returns the catalog of skills available to agents
// @Tags Chat
// @Produce json
// @Security BearerAuth
// @Success 200 {array} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/skills [get]
func (h *Handler) HandleGetSkills(c fiber.Ctx) error {
	ctx := c.Context()
	skills, err := h.GetSkills(ctx)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to retrieve skills", err.Error())
	}
	return handlerutil.RespondSuccess(c, skills)
}
