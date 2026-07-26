package llmops

import (
	"bufio"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"echo-backend/internal/service/llmops"
	"github.com/gofiber/fiber/v3"
)

type StudioHandler struct {
	playgroundSvc llmops.PlaygroundService
	auditSvc      llmops.AuditService
}

func NewStudioHandler(playgroundSvc llmops.PlaygroundService, auditSvc llmops.AuditService) *StudioHandler {
	return &StudioHandler{playgroundSvc: playgroundSvc, auditSvc: auditSvc}
}

func (h *StudioHandler) HandleRunPlayground(c fiber.Ctx) error {
	var req llmops.PlaygroundRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	if strings.TrimSpace(req.Prompt) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Prompt is required"})
	}

	results := make(chan llmops.StreamResult, 64)

	go func() {
		defer close(results)
		for _, modelID := range req.Models {
			select {
			case results <- llmops.StreamResult{
				Model: modelID,
				Event: "started",
			}:
			case <-c.Context().Done():
				return
			}
		}
		if err := h.playgroundSvc.StreamPlayground(c.Context(), req, results); err != nil {
			select {
			case results <- llmops.StreamResult{
				Event: "error",
				Error: err.Error(),
			}:
			case <-c.Context().Done():
			}
		}
	}()

	c.Response().Header.Set("Content-Type", "text/event-stream")
	c.Response().Header.Set("Cache-Control", "no-cache, no-transform")
	c.Response().Header.Set("Connection", "keep-alive")
	c.Response().Header.Set("Transfer-Encoding", "chunked")
	c.Response().Header.Set("X-Accel-Buffering", "no")

	return c.SendStreamWriter(func(w *bufio.Writer) {
		for r := range results {
			data, err := json.Marshal(r)
			if err != nil {
				continue
			}
			w.WriteString(fmt.Sprintf("data: %s\n\n", string(data)))
			if err := w.Flush(); err != nil {
				break
			}
		}
	})
}

func (h *StudioHandler) HandleQueryAuditLogs(c fiber.Ctx) error {
	tenantID := c.Get("X-Tenant-ID", "local")
	limitStr := c.Query("limit", "50")
	limit, _ := strconv.Atoi(limitStr)

	logs, err := h.auditSvc.QueryLogs(c.Context(), tenantID, limit)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"audit_logs": logs})
}
