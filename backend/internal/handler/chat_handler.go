package handler

import (
	"bufio"
	"bytes"
	"echo-backend/internal/models"
	"echo-backend/internal/observability"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gofiber/fiber/v3"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type ChatHandler struct {
	Cfg *models.Config
}

func NewChatHandler(cfg *models.Config) *ChatHandler {
	return &ChatHandler{Cfg: cfg}
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
				if err != io.EOF {
					fmt.Printf("ERROR: Stream from Agent error: %v\n", err)
				}
				break
			}
		}
	})
}
