package chat

import (
	"bufio"
	"bytes"
	"context"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/agent"
	"echo-backend/internal/models/config"
	"echo-backend/internal/repository/session"
	"echo-backend/internal/service/consolidation"
	"echo-backend/internal/service/aimodel"
	"encoding/json"
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
}

func NewHandler(
	cfg *cfgmodel.Config,
	rdb *redis.Client,
	modelSvc *aimodel.Service,
	sessionRepo *session.Repository,
	consolidationSvc *consolidation.Service,
) *Handler {
	return &Handler{
		Cfg:              cfg,
		RedisClient:      rdb,
		HonoAPIURL:       cfg.AgentHTTPURL,
		ModelSvc:         modelSvc,
		SessionRepo:      sessionRepo,
		ConsolidationSvc: consolidationSvc,
	}
}

type HistoryMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Message   string                 `json:"message"`
	Model     string                 `json:"model"`
	Mode      string                 `json:"mode"`
	SessionID string                 `json:"sessionId"`
	MissionID string                 `json:"missionId"`
	History   []HistoryMessage       `json:"history"`
	Features  []string               `json:"features"`
	Skills    []string               `json:"skills"`
	Config    map[string]interface{} `json:"config,omitempty"`
}

type Feature struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	TierRequirement string `json:"tier_requirement"`
}

type FeatureResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Locked      bool   `json:"locked"`
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

	if len(req.Features) > 0 {
		featuresCatalog, err := h.GetFeatures(ctx)
		if err == nil {
			catalogMap := make(map[string]Feature)
			for _, f := range featuresCatalog {
				catalogMap[f.ID] = f
			}
			for _, fID := range req.Features {
				if feat, exists := catalogMap[fID]; exists {
					if userTier == "free" && feat.TierRequirement == "pro" {
						return handlerutil.RespondError(c, fiber.StatusForbidden, fmt.Sprintf("Feature '%s' requires a Pro subscription.", feat.Name))
					}
				}
			}
		}
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

	if req.SessionID != "" {
		session, err := h.SessionRepo.GetByID(ctx, req.SessionID)
		if err != nil {
			return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to load session", err.Error())
		}
		if session == nil || session.Status == "deleted" {
			return handlerutil.RespondError(c, fiber.StatusNotFound, "Session not found")
		}
		if session.UserID != userID {
			return handlerutil.RespondError(c, fiber.StatusForbidden, "Forbidden: ownership mismatch")
		}

		isThresholdCrossed, err := h.ConsolidationSvc.CheckThreshold(ctx, req.SessionID)
		if err == nil && isThresholdCrossed {
			log.Printf("[CONSOLIDATION] Token threshold reached. Compacting session %s...", req.SessionID)
			err = h.ConsolidationSvc.TriggerConsolidation(ctx, req.SessionID, providerMap)
			if err != nil {
				log.Printf("[CONSOLIDATION] Error during auto-consolidation: %v", err)
			} else {
				session, _ = h.SessionRepo.GetByID(ctx, req.SessionID)
			}
		}

		dbMessages, err := h.SessionRepo.GetSessionMessages(ctx, req.SessionID)
		if err != nil {
			return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to load session history", err.Error())
		}

		if session.ContextSummary != "" {
			history = append(history, HistoryMessage{
				Role:    "system",
				Content: fmt.Sprintf("Context summary of consolidated previous turns:\n%s", session.ContextSummary),
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

	if req.SessionID == "" {
		session, err := h.SessionRepo.CreateSession(ctx, userID, db.DefaultSessionTitle)
		if err != nil {
			return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to create session")
		}
		req.SessionID = session.ID
		req.MissionID = session.ID
		nextTurn = 1
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
		"user_id":         strconv.Itoa(userID),
		"message":         req.Message,
		"model":           req.Model,
		"history":         history,
		"provider_config": providerMap,
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

func (h *Handler) HandleApproveTool(c fiber.Ctx) error {
	return h.handleHitlAction(c, "approve")
}

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

func (h *Handler) GetFeatures(ctx context.Context) ([]Feature, error) {
	cacheKey := "agent:features"

	if h.RedisClient != nil {
		cached, err := h.RedisClient.Get(ctx, cacheKey).Result()
		if err == nil && cached != "" {
			var features []Feature
			if err := json.Unmarshal([]byte(cached), &features); err == nil {
				return features, nil
			}
		}
	}

	agentURL := fmt.Sprintf("%s/api/features", h.HonoAPIURL)
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
		return nil, fmt.Errorf("agent features request failed: status %d, details: %s", resp.StatusCode, string(bodyBytes))
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var features []Feature
	if err := json.Unmarshal(bodyBytes, &features); err != nil {
		return nil, err
	}

	if h.RedisClient != nil {
		if err := h.RedisClient.Set(ctx, cacheKey, string(bodyBytes), 10*time.Minute).Err(); err != nil {
			log.Printf("Failed to cache features in Redis: %v", err)
		}
	}

	return features, nil
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

func (h *Handler) HandleGetSkills(c fiber.Ctx) error {
	ctx := c.Context()
	skills, err := h.GetSkills(ctx)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to retrieve skills", err.Error())
	}
	return handlerutil.RespondSuccess(c, skills)
}

func (h *Handler) HandleGetFeatures(c fiber.Ctx) error {
	ctx := c.Context()
	userTier := c.Get("X-User-Tier")
	if userTier == "" {
		userTier = "pro"
	}

	features, err := h.GetFeatures(ctx)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to retrieve features", err.Error())
	}

	response := make([]FeatureResponse, len(features))
	for i, f := range features {
		locked := false
		if userTier == "free" && f.TierRequirement == "pro" {
			locked = true
		}
		response[i] = FeatureResponse{
			ID:          f.ID,
			Name:        f.Name,
			Description: f.Description,
			Locked:      locked,
		}
	}

	return handlerutil.RespondSuccess(c, response)
}
