package llmops

import (
	"strconv"

	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/middleware"
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
	// Name is the display name of the new template.
	Name string `json:"name"`
	// Description is a human-readable description of the new template.
	Description string `json:"description"`
}

// HandleCreateTemplate godoc
// @Summary Create a prompt template
// @Description Creates a new prompt template (LLMOps Studio)
// @Tags Studio
// @Accept json
// @Produce json
// @Param request body createTemplateReq true "Template payload"
// @Success 201 {object} llmopsmodel.PromptTemplate "Created template"
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Security BearerAuth
// @Router /api/v1/studio/prompts [post]
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

type PromptTemplatesResponse struct {
	// Templates are the prompt templates of the tenant.
	Templates []llmopsmodel.PromptTemplate `json:"templates"`
}

// HandleListTemplates godoc
// @Summary List prompt templates
// @Description Returns all prompt templates (LLMOps Studio)
// @Tags Studio
// @Produce json
// @Security BearerAuth
// @Success 200 {object} PromptTemplatesResponse "List of prompt templates"
// @Failure 500 {object} map[string]string
// @Router /api/v1/studio/prompts [get]
func (h *PromptHandler) HandleListTemplates(c fiber.Ctx) error {
	tenantID := c.Get("X-Tenant-ID", "local")
	templates, err := h.promptSvc.ListTemplates(c.Context(), tenantID)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, err.Error())
	}

	if templates == nil {
		templates = []llmopsmodel.PromptTemplate{}
	}

	return handlerutil.RespondSuccess(c, PromptTemplatesResponse{Templates: templates})
}

type createVersionReq struct {
	// SystemPrompt is the full system prompt text.
	SystemPrompt string `json:"system_prompt"`
	// BoundTools are the tools the prompt is allowed to call.
	BoundTools []string `json:"bound_tools"`
	// Variables are the template variables used by the prompt.
	Variables []string `json:"variables"`
}

// HandleCreateVersion godoc
// @Summary Create a prompt template version
// @Description Creates a new version of a prompt template (LLMOps Studio)
// @Tags Studio
// @Accept json
// @Produce json
// @Param id path string true "Template ID"
// @Param request body createVersionReq true "Version payload"
// @Success 201 {object} llmopsmodel.PromptVersion "Created version"
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Security BearerAuth
// @Router /api/v1/studio/prompts/{id}/versions [post]
func (h *PromptHandler) HandleCreateVersion(c fiber.Ctx) error {
	templateID := c.Params("id")
	actor := middleware.UserEmail(c)
	if actor == "" {
		actor = "unknown@echo.internal"
	}

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

// HandleGetVersion godoc
// @Summary Get a prompt template version
// @Description Returns a specific version of a prompt template (LLMOps Studio)
// @Tags Studio
// @Produce json
// @Param id path string true "Template ID"
// @Param v path int true "Version number"
// @Success 200 {object} llmopsmodel.PromptVersion "Prompt template version"
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Security BearerAuth
// @Router /api/v1/studio/prompts/{id}/versions/{v} [get]
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

// HandleGetActivePrompt godoc
// @Summary Get active prompt
// @Description Returns the active production version of a prompt template (LLMOps Studio)
// @Tags Studio
// @Produce json
// @Param name query string true "Template name"
// @Success 200 {object} llmopsmodel.PromptVersion "Active production prompt version"
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Security BearerAuth
// @Router /api/v1/studio/prompts/active [get]
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

// PromptVersionsResponse is the response for listing prompt template versions.
type PromptVersionsResponse struct {
	// Versions is the version history of the template.
	Versions []llmopsmodel.PromptVersion `json:"versions"`
}

// HandleListVersions godoc
// @Summary List prompt template versions
// @Description Returns the version history of a prompt template (LLMOps Studio)
// @Tags Studio
// @Produce json
// @Param id path string true "Template ID"
// @Success 200 {object} PromptVersionsResponse "Version history"
// @Failure 500 {object} map[string]string
// @Security BearerAuth
// @Router /api/v1/studio/prompts/{id}/versions [get]
func (h *PromptHandler) HandleListVersions(c fiber.Ctx) error {
	templateID := c.Params("id")
	versions, err := h.promptSvc.GetVersionHistory(c.Context(), templateID)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, err.Error())
	}

	return handlerutil.RespondSuccess(c, PromptVersionsResponse{Versions: versions})
}

// PromoteResponse is the response for promoting a prompt template version.
type PromoteResponse struct {
	// Status is the outcome of the promotion.
	Status string `json:"status"`
	// PromotedVersion is the version promoted to production.
	PromotedVersion int `json:"promoted_version"`
}

// HandlePromote godoc
// @Summary Promote a prompt template version
// @Description Promotes a version to production (LLMOps Studio)
// @Tags Studio
// @Produce json
// @Param id path string true "Template ID"
// @Param version path int true "Version number"
// @Success 200 {object} PromoteResponse "Promotion result"
// @Failure 500 {object} map[string]string
// @Security BearerAuth
// @Router /api/v1/studio/prompts/{id}/promote/{version} [post]
func (h *PromptHandler) HandlePromote(c fiber.Ctx) error {
	templateID := c.Params("id")
	versionStr := c.Params("version")
	version, err := strconv.Atoi(versionStr)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid version parameter")
	}
	actor := middleware.UserEmail(c)
	if actor == "" {
		actor = "unknown@echo.internal"
	}

	err = h.promptSvc.PromoteToProduction(c.Context(), templateID, version, actor)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, err.Error())
	}

	return handlerutil.RespondSuccess(c, PromoteResponse{Status: "success", PromotedVersion: version})
}

// RollbackResponse is the response for rolling back a prompt template version.
type RollbackResponse struct {
	// Status is the outcome of the rollback.
	Status string `json:"status"`
	// RolledBackTo is the version the template was rolled back to.
	RolledBackTo int `json:"rolled_back_to"`
}

// HandleRollback godoc
// @Summary Rollback a prompt template version
// @Description Rolls back the production version of a prompt template (LLMOps Studio)
// @Tags Studio
// @Produce json
// @Param id path string true "Template ID"
// @Param version path int true "Version number"
// @Success 200 {object} RollbackResponse "Rollback result"
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Security BearerAuth
// @Router /api/v1/studio/prompts/{id}/rollback/{version} [post]
func (h *PromptHandler) HandleRollback(c fiber.Ctx) error {
	templateID := c.Params("id")
	versionStr := c.Params("version")
	version, err := strconv.Atoi(versionStr)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid version parameter")
	}

	actor := middleware.UserEmail(c)
	if actor == "" {
		actor = "unknown@echo.internal"
	}
	err = h.promptSvc.RollbackToVersion(c.Context(), templateID, version, actor)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, err.Error())
	}

	return handlerutil.RespondSuccess(c, RollbackResponse{Status: "success", RolledBackTo: version})
}
