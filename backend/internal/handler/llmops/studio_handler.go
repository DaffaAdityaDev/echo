package llmops

import (
	"strconv"

	"echo-backend/internal/service/llmops"
	"github.com/gofiber/fiber/v3"
)

type StudioHandler struct {
	auditSvc llmops.AuditService
}

func NewStudioHandler(auditSvc llmops.AuditService) *StudioHandler {
	return &StudioHandler{auditSvc: auditSvc}
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

type playgroundRunReq struct {
	SystemPrompt string            `json:"system_prompt"`
	UserQuery    string            `json:"user_query"`
	Variables    map[string]string `json:"variables"`
	Models       []string          `json:"models"`
}

type PlaygroundResult struct {
	Model     string `json:"model"`
	Content   string `json:"content"`
	LatencyMS int    `json:"latency_ms"`
	Tokens    int    `json:"tokens"`
	Error     string `json:"error,omitempty"`
}

func (h *StudioHandler) HandleRunPlayground(c fiber.Ctx) error {
	var req playgroundRunReq
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	if len(req.Models) == 0 {
		req.Models = []string{"gpt-4o", "claude-3-5-sonnet", "lm-studio"}
	}

	results := make([]PlaygroundResult, 0, len(req.Models))
	for _, m := range req.Models {
		results = append(results, PlaygroundResult{
			Model:     m,
			Content:   "Output generated for model " + m + ". Prompt: " + req.SystemPrompt,
			LatencyMS: 240,
			Tokens:    120,
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"results": results,
	})
}
