package handler

import (
	"bufio"
	"bytes"
	"context"
	"echo-backend/internal/models"
	"echo-backend/internal/observability"
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
}

func NewChatHandler(cfg *models.Config, rdb *redis.Client) *ChatHandler {
	return &ChatHandler{
		Cfg:         cfg,
		RedisClient: rdb,
		HonoAPIURL:  cfg.AgentHTTPURL,
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

	// Forward the mode to the agent via query param
	agentURL := fmt.Sprintf("%s/api/generate-mission?mode=%s", h.Cfg.AgentHTTPURL, req.Mode)

	// Prepare payload for Agent, including conversation history and missionId
	payload := map[string]interface{}{
		"user_id":    1,
		"message":    req.Message,
		"model":      req.Model,
		"history":    req.History,
	}
	if req.MissionID != "" {
		payload["missionId"] = req.MissionID
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

	// Set headers for streaming
	c.Response().Header.Set("Content-Type", "text/event-stream")
	c.Response().Header.Set("Cache-Control", "no-cache")
	c.Response().Header.Set("Connection", "keep-alive")
	c.Response().Header.Set("Transfer-Encoding", "chunked")

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

	// 1. Establish SSE Headers on the Response
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

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
			req, err := http.NewRequestWithContext(context.Background(), "GET", honoStreamURL, nil)
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
