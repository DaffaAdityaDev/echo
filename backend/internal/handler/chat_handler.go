package handler

import (
	"bufio"
	"bytes"
	"context"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/models"
	"echo-backend/internal/repository"
	"echo-backend/internal/service"
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

var sessionLocks sync.Map // map[string]*sync.Mutex

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

type ChatHandler struct {
	Cfg              *models.Config
	RedisClient      *redis.Client
	HonoAPIURL       string
	ModelSvc         *service.ModelService
	SessionRepo      *repository.SessionRepository
	ConsolidationSvc *service.ConsolidationService
}

func NewChatHandler(
	cfg *models.Config,
	rdb *redis.Client,
	modelSvc *service.ModelService,
	sessionRepo *repository.SessionRepository,
	consolidationSvc *service.ConsolidationService,
) *ChatHandler {
	return &ChatHandler{
		Cfg:              cfg,
		RedisClient:      rdb,
		HonoAPIURL:       cfg.AgentHTTPURL,
		ModelSvc:         modelSvc,
		SessionRepo:      sessionRepo,
		ConsolidationSvc: consolidationSvc,
	}
}

type HistoryMessage struct {
	Role    string `json:"role" example:"user"`
	Content string `json:"content" example:"What is Echo and how does it work?"`
}

type ChatRequest struct {
	Message   string           `json:"message" example:"Explain how the Echo agent works"`
	Model     string           `json:"model" example:"gpt-4o"`
	Mode      string           `json:"mode" example:"agent"`
	SessionID string           `json:"sessionId" example:"sess_abc123"`
	MissionID string           `json:"missionId" example:"mission_xyz789"`
	History   []HistoryMessage `json:"history"`
	Features  []string         `json:"features" example:"web-browsing,code-interpreter"`
	Skills    []string         `json:"skills" example:"python,research"`
}

type Feature struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	TierRequirement string `json:"tier_requirement"`
}

type FeatureResponse struct {
	ID          string `json:"id" example:"web-browsing"`
	Name        string `json:"name" example:"Web Browsing"`
	Description string `json:"description" example:"Browse the web in real-time to fetch up-to-date information"`
	Locked      bool   `json:"locked" example:"false"`
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

// @Summary Send chat message & stream response (SSE)
// @Description Stream LLM response packets (SSE) for user message in a session or mission
// @Tags Chat
// @Accept json
// @Produce text/event-stream
// @Security BearerAuth
// @Param request body ChatRequest true "Chat prompt and session parameters"
// @Success 200 {string} string "Server-Sent Events stream (data: JSON)"
// @Failure 400 {object} map[string]string "Invalid request body or unknown model/skill"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden / Feature tier requirement"
// @Failure 404 {object} map[string]string "Session not found"
// @Router /api/v1/chat [post]
func (h *ChatHandler) HandleChat(c fiber.Ctx) error {
	var req ChatRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	ctx := c.Context()
	tpHeader := c.Get("traceparent")
	if sc, ok := parseTraceparent(tpHeader); ok {
		ctx = trace.ContextWithRemoteSpanContext(ctx, sc)
	}

	// Get authenticated user ID
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	userTier := c.Get("X-User-Tier")
	if userTier == "" {
		userTier = "pro" // Default to pro for local backward-compatibility
	}

	// Validate features payload against user tier requirements
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
						return c.Status(403).JSON(fiber.Map{
							"error": fmt.Sprintf("Feature '%s' requires a Pro subscription.", feat.Name),
						})
					}
				}
			}
		}
	}

	// Resolve model to provider configuration
	modelID := req.Model
	if modelID == "" {
		modelID = h.ModelSvc.GetDefault().Model
	}
	providerCfg, err := h.ModelSvc.ResolveModel(modelID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("Unknown model '%s'", modelID),
		})
	}

	// Validate skills payload (only fetch catalog if skills were sent)
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
					return c.Status(400).JSON(fiber.Map{
						"error": fmt.Sprintf("Unknown skill '%s'", skillName),
					})
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

	// Load and validate session if SessionID is provided
	var history []HistoryMessage
	nextTurn := 1

	if req.SessionID != "" {
		session, err := h.SessionRepo.GetByID(ctx, req.SessionID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to load session", "details": err.Error()})
		}
		if session == nil || session.Status == "deleted" {
			return c.Status(404).JSON(fiber.Map{"error": "Session not found"})
		}
		if session.UserID != userID {
			return c.Status(403).JSON(fiber.Map{"error": "Forbidden: ownership mismatch"})
		}

		// Check/trigger token consolidation before running the turn
		isThresholdCrossed, err := h.ConsolidationSvc.CheckThreshold(ctx, req.SessionID)
		if err == nil && isThresholdCrossed {
			log.Printf("[CONSOLIDATION] Token threshold reached. Compacting session %s...", req.SessionID)
			err = h.ConsolidationSvc.TriggerConsolidation(ctx, req.SessionID, providerMap)
			if err != nil {
				log.Printf("[CONSOLIDATION] Error during auto-consolidation: %v", err)
			} else {
				// Reload session after consolidation
				session, _ = h.SessionRepo.GetByID(ctx, req.SessionID)
			}
		}

		// Load existing messages
		dbMessages, err := h.SessionRepo.GetSessionMessages(ctx, req.SessionID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to load session history", "details": err.Error()})
		}

		// Prepend context summary as system message if it exists
		if session.ContextSummary != "" {
			history = append(history, HistoryMessage{
				Role:    "system",
				Content: fmt.Sprintf("Context summary of consolidated previous turns:\n%s", session.ContextSummary),
			})
		}

		// Convert DB messages to history array and find max turn
		// Strip thought, tool_call, tool_result — only user+assistant+system go to LLM
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
		// Fallback to client-provided history if SessionID is empty
		history = req.History
	}

	// Auto-create session if none provided
	if req.SessionID == "" {
		session, err := h.SessionRepo.CreateSession(ctx, userID, db.DefaultSessionTitle)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create session"})
		}
		req.SessionID = session.ID
		req.MissionID = session.ID
		nextTurn = 1
	}

	// Acquire session-level lock for isolation across concurrent requests on the same session
	unlock := acquireSessionLock(req.SessionID)
	defer unlock()

	// Prepare turn atomically via ACID transaction (Mark interrupted + Save User Msg + Insert Assistant Placeholder)
	userTokenCount := len(req.Message) / 4
	if userTokenCount == 0 && len(req.Message) > 0 {
		userTokenCount = 1
	}
	assistantMsgID, err := h.SessionRepo.PrepareTurn(ctx, req.SessionID, req.Message, userTokenCount, nextTurn)
	if err != nil {
		log.Printf("[CHAT] Failed to prepare turn for session %s: %v", req.SessionID, err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to prepare chat turn", "details": err.Error()})
	}

	// Forward the mode to the agent via query param
	agentURL := fmt.Sprintf("%s/api/generate-mission?mode=%s", h.Cfg.AgentHTTPURL, req.Mode)

	// Prepare payload for Agent, including provider_config, history and missionId
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
	jsonPayload, _ := json.Marshal(payload)

	// Create request to Agent
	agentReq, err := http.NewRequestWithContext(ctx, "POST", agentURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create request to agent"})
	}
	agentReq.Header.Set("Content-Type", "application/json")
	agentReq.Header.Set("X-Internal-Token", h.Cfg.InternalAuthToken)

	// Propagate traceparent header to downstream Agent
	newTraceContext := trace.SpanContextFromContext(ctx)
	agentTraceparent := fmt.Sprintf("00-%s-%s-01", newTraceContext.TraceID().String(), newTraceContext.SpanID().String())
	agentReq.Header.Set("traceparent", agentTraceparent)

	// Call Agent
	resp, err := httpClient.Do(agentReq)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Agent service unreachable"})
	}

	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		bodyBytes, _ := io.ReadAll(resp.Body)
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": "Agent request failed", "details": string(bodyBytes)})
	}

	// Set headers for streaming (bypass compression and caching)
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
			title       string
			summary     string
			toolCalls   []ToolCallCapture
			toolResults []ToolCallResult
			isComplete  bool
		}

		sc := &streamContent{}

		flushCtx, flushCancel := context.WithCancel(context.Background())
		defer flushCancel()

		// Periodic flush goroutine: flushes partial content to PG every 2s
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
			var steps []models.ThoughtStep
			if thinking != "" {
				steps = append(steps, models.ThoughtStep{Type: "reasoning", Content: thinking})
			}
			for _, tc := range calls {
				steps = append(steps, models.ThoughtStep{Type: "tool_call", ToolName: tc.ToolName, ToolInput: tc.ToolInput})
			}
			for _, tr := range results {
				steps = append(steps, models.ThoughtStep{Type: "tool_result", ToolName: tr.ToolName, Content: tr.Content})
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
						case "metadata":
							if packet.Title != "" {
								sc.title = packet.Title
								sc.summary = packet.Summary
								titleToSave := packet.Title
								summaryToSave := packet.Summary
								go func() {
									dbCtx, dbCancel := context.WithTimeout(context.Background(), 5*time.Second)
									defer dbCancel()
									err := h.SessionRepo.UpdateTitleAndSummary(dbCtx, req.SessionID, titleToSave, summaryToSave)
									if err != nil {
										log.Printf("[CHAT] Error saving title for session %s: %v", req.SessionID, err)
									} else {
										log.Printf("[CHAT] Successfully updated title for session %s: '%s'", req.SessionID, titleToSave)
									}
								}()
							}
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

		flushCancel() // stop flush goroutine

		sc.mu.RLock()
		finalContent := sc.content.String()
		finalThinking := sc.thinking.String()
		finalCalls := sc.toolCalls
		finalResults := sc.toolResults
		finalTitle := sc.title
		finalSummary := sc.summary
		complete := sc.isComplete
		sc.mu.RUnlock()

		status := "interrupted"
		if complete {
			status = "complete"
		}

		steps := buildStepsJSON(finalThinking, finalCalls, finalResults)

		// Execute CompleteTurn (Update content + status + session timestamp) atomically inside 1 ACID transaction with 3 retries
		err = retryDBOperation(3, 100*time.Millisecond, func() error {
			dbCtx, dbCancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer dbCancel()
			return h.SessionRepo.CompleteTurn(dbCtx, assistantMsgID, req.SessionID, finalContent, steps, len(finalContent)/4, status)
		})
		if err != nil {
			log.Printf("[CHAT] Error executing CompleteTurn transaction for msg %d: %v", assistantMsgID, err)
		}

		if finalTitle != "" {
			dbCtx, dbCancel := context.WithTimeout(context.Background(), 5*time.Second)
			_ = h.SessionRepo.UpdateTitleAndSummary(dbCtx, req.SessionID, finalTitle, finalSummary)
			dbCancel()
		}

		log.Printf("[CHAT] Completed turn %d for session %s (status=%s, content_len=%d)", nextTurn, req.SessionID, status, len(finalContent))
	})
}

// StreamMissionLogs dynamically proxies the stream based on AGENT_RUNTIME_MODE
// @Summary Stream mission logs (SSE)
// @Description Stream execution logs for a running mission via Redis PubSub (SaaS mode) or agent proxy (Local mode)
// @Tags Chat
// @Produce text/event-stream
// @Param missionId path string true "Mission ID"
// @Success 200 {string} string "Server-Sent Events log stream"
// @Failure 400 {object} map[string]string "Missing mission ID"
// @Router /v1/missions/{missionId}/stream [get]
func (h *ChatHandler) StreamMissionLogs(c fiber.Ctx) error {
	missionID := c.Params("missionId")
	if missionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missionId is required"})
	}

	runtimeMode := os.Getenv("AGENT_RUNTIME_MODE")
	if runtimeMode == "" {
		runtimeMode = "local" // Default to safe local mode
	}

	// 1. Establish SSE Headers on the Response (bypass compression and caching)
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache, no-transform")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")
	c.Set("X-Accel-Buffering", "no")

	// 2. Execute Dynamic Streaming Strategies
	if runtimeMode == "saas" {
		if h.RedisClient == nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Redis state store is offline"})
		}
		
		// --- SaaS MODE: Stream Directly from Shared Redis Cluster ---
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
						return // Client closed tab/socket
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
		// --- LOCAL MODE: Reverse-Proxy Hono's In-Memory Node SSE Stream ---
		honoStreamURL := fmt.Sprintf("%s/api/v1/missions/%s/stream", h.HonoAPIURL, missionID)
		
		return c.SendStreamWriter(func(w *bufio.Writer) {
			reqCtx, reqCancel := context.WithCancel(c.Context())
			defer reqCancel()

			req, err := http.NewRequestWithContext(reqCtx, "GET", honoStreamURL, nil)
			if err != nil {
				return
			}

			resp, err := httpClient.Do(req)
			if err != nil {
				return
			}
			defer resp.Body.Close()

			reader := bufio.NewReader(resp.Body)

			for {
				// Read raw SSE chunk line-by-line from Hono
				line, err := reader.ReadBytes('\n')
				if err != nil {
					return // End of stream or connection closed
				}

				// Write line directly back to client context
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

// GetFeatures retrieves feature metadata from Hono and caches them in Redis for 10 minutes.
func (h *ChatHandler) GetFeatures(ctx context.Context) ([]Feature, error) {
	cacheKey := "agent:features"

	// 1. Try to read from Redis
	if h.RedisClient != nil {
		cached, err := h.RedisClient.Get(ctx, cacheKey).Result()
		if err == nil && cached != "" {
			var features []Feature
			if err := json.Unmarshal([]byte(cached), &features); err == nil {
				return features, nil
			}
		}
	}

	// 2. Fetch from Hono
	agentURL := fmt.Sprintf("%s/api/features", h.HonoAPIURL)
	req, err := http.NewRequestWithContext(ctx, "GET", agentURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Internal-Token", h.Cfg.InternalAuthToken)

	resp, err := httpClient.Do(req)
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

	// Cache in Redis
	if h.RedisClient != nil {
		if err := h.RedisClient.Set(ctx, cacheKey, string(bodyBytes), 10*time.Minute).Err(); err != nil {
			log.Printf("Failed to cache features in Redis: %v", err)
		}
	}

	return features, nil
}

// GetSkills retrieves skill metadata from Hono and caches them in Redis for 10 minutes.
func (h *ChatHandler) GetSkills(ctx context.Context) ([]map[string]interface{}, error) {
	cacheKey := "agent:skills"

	// 1. Try to read from Redis
	if h.RedisClient != nil {
		cached, err := h.RedisClient.Get(ctx, cacheKey).Result()
		if err == nil && cached != "" {
			var skills []map[string]interface{}
			if err := json.Unmarshal([]byte(cached), &skills); err == nil {
				return skills, nil
			}
		}
	}

	// 2. Fetch from Hono
	agentURL := fmt.Sprintf("%s/api/skills", h.HonoAPIURL)
	req, err := http.NewRequestWithContext(ctx, "GET", agentURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Internal-Token", h.Cfg.InternalAuthToken)

	resp, err := httpClient.Do(req)
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

	// Cache in Redis
	if h.RedisClient != nil {
		if err := h.RedisClient.Set(ctx, cacheKey, string(bodyBytes), 10*time.Minute).Err(); err != nil {
			log.Printf("Failed to cache skills in Redis: %v", err)
		}
	}

	return skills, nil
}

// HandleGetSkills returns the catalog of skills from the agent.
// @Summary Get agent skills catalog
// @Description Fetch available skill definitions from the agent service
// @Tags Chat
// @Produce json
// @Success 200 {array} map[string]interface{} "List of agent skills"
// @Failure 500 {object} map[string]string "Failed to retrieve skills"
// @Router /api/v1/skills [get]
func (h *ChatHandler) HandleGetSkills(c fiber.Ctx) error {
	ctx := c.Context()
	skills, err := h.GetSkills(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve skills", "details": err.Error()})
	}
	return c.JSON(skills)
}

// HandleGetFeatures returns the catalog of features, dynamically locking premium ones depending on user tier.
// @Summary Get available features catalog
// @Description Fetch available features and their lock status based on user tier header (X-User-Tier)
// @Tags Chat
// @Produce json
// @Success 200 {array} FeatureResponse "List of features with lock states"
// @Failure 500 {object} map[string]string "Failed to retrieve features"
// @Router /api/v1/features [get]
func (h *ChatHandler) HandleGetFeatures(c fiber.Ctx) error {
	ctx := c.Context()
	userTier := c.Get("X-User-Tier")
	if userTier == "" {
		userTier = "pro" // Default to pro for local backward-compatibility
	}

	features, err := h.GetFeatures(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve features", "details": err.Error()})
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

	return c.JSON(response)
}
