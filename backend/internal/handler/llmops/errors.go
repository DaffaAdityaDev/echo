package llmops

import (
	"errors"
	"log/slog"

	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/llmops"
	"github.com/gofiber/fiber/v3"
)

const msgPromptInternalError = "Prompt request failed"

// respondPromptError maps prompt service errors to HTTP statuses so clients
// can tell invalid input, conflicts and missing resources from server faults.
// Unexpected errors are logged and answered generically so database details
// never reach the client.
func respondPromptError(c fiber.Ctx, err error) error {
	status := promptErrorStatus(err)
	if status == fiber.StatusInternalServerError {
		slog.Error(msgconst.ErrLLMOpsPromptRequest, msgconst.ComponentKey, msgconst.ComponentLLMOps, msgconst.KeyErr, err)
		return handlerutil.RespondError(c, status, msgPromptInternalError)
	}
	return handlerutil.RespondError(c, status, err.Error())
}

func promptErrorStatus(err error) int {
	switch {
	case errors.Is(err, llmopsmodel.ErrTemplateNameRequired):
		return fiber.StatusBadRequest
	case errors.Is(err, llmopsmodel.ErrTemplateNameTaken), errors.Is(err, llmopsmodel.ErrVersionRolledBack):
		return fiber.StatusConflict
	case errors.Is(err, llmopsmodel.ErrTemplateNotFound), errors.Is(err, llmopsmodel.ErrVersionNotFound):
		return fiber.StatusNotFound
	default:
		return fiber.StatusInternalServerError
	}
}
