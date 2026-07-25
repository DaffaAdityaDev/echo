package llmops

import (
	"strconv"

	"echo-backend/internal/models"
	"echo-backend/internal/service/llmops"
	"github.com/gofiber/fiber/v3"
)

type PromptHandler struct {
	promptSvc llmops.PromptService
}

func NewPromptHandler(promptSvc llmops.PromptService) *PromptHandler {
	return &PromptHandler{promptSvc: promptSvc}
}

type createTemplateReq struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (h *PromptHandler) HandleCreateTemplate(c fiber.Ctx) error {
	var req createTemplateReq
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	tenantID := c.Get("X-Tenant-ID", "local")
	tmpl, err := h.promptSvc.CreatePromptTemplate(c.Context(), tenantID, req.Name, req.Description)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(tmpl)
}

func (h *PromptHandler) HandleListTemplates(c fiber.Ctx) error {
	tenantID := c.Get("X-Tenant-ID", "local")
	templates, err := h.promptSvc.ListTemplates(c.Context(), tenantID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if templates == nil {
		templates = []models.PromptTemplate{}
	}

	return c.JSON(fiber.Map{"templates": templates})
}

type createVersionReq struct {
	SystemPrompt string   `json:"system_prompt"`
	BoundTools   []string `json:"bound_tools"`
	Variables    []string `json:"variables"`
}

func (h *PromptHandler) HandleCreateVersion(c fiber.Ctx) error {
	templateID := c.Params("id")
	actor := c.Get("X-User-Email", "unknown@echo.internal")

	var req createVersionReq
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	version, err := h.promptSvc.CreateNewVersion(c.Context(), templateID, req.SystemPrompt, actor, req.BoundTools, req.Variables)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(version)
}

func (h *PromptHandler) HandleGetVersion(c fiber.Ctx) error {
	templateID := c.Params("id")
	versionStr := c.Params("v")
	version, err := strconv.Atoi(versionStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid version parameter"})
	}

	pv, err := h.promptSvc.GetVersion(c.Context(), templateID, version)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(pv)
}

func (h *PromptHandler) HandleGetActivePrompt(c fiber.Ctx) error {
	templateName := c.Query("name")
	if templateName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Query parameter 'name' is required"})
	}

	tenantID := c.Get("X-Tenant-ID", "local")
	pv, err := h.promptSvc.GetActivePrompt(c.Context(), tenantID, templateName)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(pv)
}

func (h *PromptHandler) HandleListVersions(c fiber.Ctx) error {
	templateID := c.Params("id")
	versions, err := h.promptSvc.GetVersionHistory(c.Context(), templateID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"versions": versions})
}

func (h *PromptHandler) HandlePromote(c fiber.Ctx) error {
	templateID := c.Params("id")
	versionStr := c.Params("version")
	version, _ := strconv.Atoi(versionStr)
	actor := c.Get("X-User-Email", "unknown@echo.internal")

	err := h.promptSvc.PromoteToProduction(c.Context(), templateID, version, actor)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"status": "success", "promoted_version": version})
}

func (h *PromptHandler) HandleRollback(c fiber.Ctx) error {
	templateID := c.Params("id")
	versionStr := c.Params("version")
	version, err := strconv.Atoi(versionStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid version parameter"})
	}

	actor := c.Get("X-User-Email", "unknown@echo.internal")
	err = h.promptSvc.RollbackToVersion(c.Context(), templateID, version, actor)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"status": "success", "rolled_back_to": version})
}
