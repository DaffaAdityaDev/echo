package llmops

import (
	"echo-backend/internal/models"
	"echo-backend/internal/service/llmops"
	"github.com/gofiber/fiber/v3"
)

type EvalHandler struct {
	evalSvc llmops.EvalService
}

func NewEvalHandler(evalSvc llmops.EvalService) *EvalHandler {
	return &EvalHandler{evalSvc: evalSvc}
}

type uploadDatasetReq struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	TestCases   []models.TestCase `json:"test_cases"`
}

func (h *EvalHandler) HandleUploadDataset(c fiber.Ctx) error {
	var req uploadDatasetReq
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	tenantID := c.Get("X-Tenant-ID", "local")
	actor := c.Get("X-User-Email", "unknown@echo.internal")

	dataset := &models.EvalDataset{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		TestCases:   req.TestCases,
		CreatedBy:   actor,
	}

	created, err := h.evalSvc.CreateDataset(c.Context(), dataset)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(created)
}

type runEvalReq struct {
	PromptVersionID string `json:"prompt_version_id"`
	DatasetID       string `json:"dataset_id"`
}

func (h *EvalHandler) HandleRunEval(c fiber.Ctx) error {
	var req runEvalReq
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	executor := c.Get("X-User-Email", "unknown@echo.internal")
	result, err := h.evalSvc.RunEvalSuite(c.Context(), req.PromptVersionID, req.DatasetID, executor)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(200).JSON(result)
}

func (h *EvalHandler) HandleGetEvalRun(c fiber.Ctx) error {
	runID := c.Params("id")
	run, err := h.evalSvc.GetEvalRunResults(c.Context(), runID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(run)
}
