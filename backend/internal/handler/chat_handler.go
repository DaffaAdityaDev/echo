package handler

import (
	"bufio"
	"bytes"
	"context"
	"echo-backend/internal/models"
	"echo-backend/internal/observability"
	"echo-backend/internal/service"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type ChatHandler struct {
	Cfg         *models.Config
	RedisClient *redis.Client
	HonoAPIURL  string
	ModelSvc    service.ModelService
}

func NewChatHandler(cfg *models.Config, rdb *redis.Client, modelSvc service.ModelService) *ChatHandler {
	return &ChatHandler{
		Cfg:         cfg,
		RedisClient: rdb,
		HonoAPIURL:  cfg.AgentHTTPURL,
		ModelSvc:    modelSvc,
	}
}

type HistoryMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Message   string           `json:"message"`
	Model     string           `json:"model"`
	Mode      string           `json:"mode"`
	MissionID string           `json:"missionId"`
	History   []HistoryMessage `json:"history"`
	Features  []string         `json:"features"`
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

	ctx, span := observability.Tracer.Start(ctx, "HandleChat", trace.WithAttributes(
		attribute.String("agent.session_id", req.MissionID),
		attribute.String("mission.id", req.MissionID),
		attribute.String("llm.model", req.Model),
	))
	defer span.End()

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
						span.RecordError(fmt.Errorf("access denied: feature %s requires pro", feat.Name))
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

	// Forward the mode to the agent via query param
	agentURL := fmt.Sprintf("%s/api/generate-mission?mode=%s", h.Cfg.AgentHTTPURL, req.Mode)

	providerMap := map[string]interface{}{
		"type":     providerCfg.Type,
		"base_url": providerCfg.BaseURL,
		"model":    providerCfg.Model,
	}
	if providerCfg.APIKey != "" {
		providerMap["api_key"] = providerCfg.APIKey
	}

	// Prepare payload for Agent, including provider_config, conversation history and missionId
	payload := map[string]interface{}{
		"user_id":         1,
		"message":         req.Message,
		"model":           req.Model,
		"history":         req.History,
		"provider_config": providerMap,
	}
	if req.MissionID != "" {
		payload["missionId"] = req.MissionID
	}
	if len(req.Features) > 0 {
		payload["features"] = req.Features
	}
	jsonPayload, _ := json.Marshal(payload)

	// Create request to Agent
	client := &http.Client{}
	agentReq, err := http.NewRequestWithContext(ctx, "POST", agentURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		span.RecordError(err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create request to agent"})
	}
	agentReq.Header.Set("Content-Type", "application/json")
	agentReq.Header.Set("X-Internal-Token", h.Cfg.InternalAuthToken)

	// Propagate traceparent header to downstream Agent
	newTraceContext := span.SpanContext()
	agentTraceparent := fmt.Sprintf("00-%s-%s-01", newTraceContext.TraceID().String(), newTraceContext.SpanID().String())
	agentReq.Header.Set("traceparent", agentTraceparent)

	// Call Agent
	resp, err := client.Do(agentReq)
	if err != nil {
		span.RecordError(err)
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
		reader := resp.Body
		defer reader.Close()

		buf := make([]byte, 512)
		for {
			n, err := reader.Read(buf)
			if n > 0 {
				if _, err := w.Write(buf[:n]); err != nil {
					break
				}
				if err := w.Flush(); err != nil {
					break
				}
			}
			if err != nil {
				break
			}
		}
	})
}

// StreamMissionLogs dynamically proxies the stream based on AGENT_RUNTIME_MODE
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

			client := &http.Client{}
			resp, err := client.Do(req)
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

	client := &http.Client{}
	resp, err := client.Do(req)
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
		_ = h.RedisClient.Set(ctx, cacheKey, string(bodyBytes), 10*time.Minute).Err()
	}

	return features, nil
}

// HandleGetFeatures returns the catalog of features, dynamically locking premium ones depending on user tier.
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
