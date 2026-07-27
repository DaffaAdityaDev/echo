package llmops

import (
	"strconv"

	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/llmops"
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
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	tenantID := c.Get("X-Tenant-ID", "local")
	tmpl, err := h.promptSvc.CreatePromptTemplate(c.Context(), tenantID, req.Name, req.Description)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, err.Error())
	}

	return handlerutil.RespondCreated(c, tmpl)
}

func (h *PromptHandler) HandleListTemplates(c fiber.Ctx) error {
	tenantID := c.Get("X-Tenant-ID", "local")
	templates, err := h.promptSvc.ListTemplates(c.Context(), tenantID)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, err.Error())
	}

	if templates == nil {
		templates = []llmopsmodel.PromptTemplate{}
	}

	return handlerutil.RespondSuccess(c, fiber.Map{"templates": templates})
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
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	version, err := h.promptSvc.CreateNewVersion(c.Context(), templateID, req.SystemPrompt, actor, req.BoundTools, req.Variables)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, err.Error())
	}

	return handlerutil.RespondCreated(c, version)
}

func (h *PromptHandler) HandleGetVersion(c fiber.Ctx) error {
	templateID := c.Params("id")
	versionStr := c.Params("v")
	version, err := strconv.Atoi(versionStr)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid version parameter")
	}

	pv, err := h.promptSvc.GetVersion(c.Context(), templateID, version)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusNotFound, err.Error())
	}

	return handlerutil.RespondSuccess(c, pv)
}

func (h *PromptHandler) HandleGetActivePrompt(c fiber.Ctx) error {
	templateName := c.Query("name")
	if templateName == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Query parameter 'name' is required")
	}

	tenantID := c.Get("X-Tenant-ID", "local")
	pv, err := h.promptSvc.GetActivePrompt(c.Context(), tenantID, templateName)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusNotFound, err.Error())
	}

	return handlerutil.RespondSuccess(c, pv)
}

func (h *PromptHandler) HandleListVersions(c fiber.Ctx) error {
	templateID := c.Params("id")
	versions, err := h.promptSvc.GetVersionHistory(c.Context(), templateID)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, err.Error())
	}

	return handlerutil.RespondSuccess(c, fiber.Map{"versions": versions})
}

func (h *PromptHandler) HandlePromote(c fiber.Ctx) error {
	templateID := c.Params("id")
	versionStr := c.Params("version")
	version, _ := strconv.Atoi(versionStr)
	actor := c.Get("X-User-Email", "unknown@echo.internal")

	err := h.promptSvc.PromoteToProduction(c.Context(), templateID, version, actor)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, err.Error())
	}

	return handlerutil.RespondSuccess(c, fiber.Map{"status": "success", "promoted_version": version})
}

func (h *PromptHandler) HandleRollback(c fiber.Ctx) error {
	templateID := c.Params("id")
	versionStr := c.Params("version")
	version, err := strconv.Atoi(versionStr)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid version parameter")
	}

	actor := c.Get("X-User-Email", "unknown@echo.internal")
	err = h.promptSvc.RollbackToVersion(c.Context(), templateID, version, actor)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, err.Error())
	}

	return handlerutil.RespondSuccess(c, fiber.Map{"status": "success", "rolled_back_to": version})
}
