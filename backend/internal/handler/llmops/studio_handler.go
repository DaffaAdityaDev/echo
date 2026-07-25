package llmops

import (
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

	results, err := h.playgroundSvc.RunPlayground(c.Context(), req)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"results": results,
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
