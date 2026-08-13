package chat

import (
	"github.com/gofiber/fiber/v3"

	"echo-backend/internal/handler/handlerutil"
)

// parseChatRequest binds the chat request payload, responding with 400 when
// the body is not valid JSON matching ChatRequest.
func parseChatRequest(c fiber.Ctx) (*ChatRequest, error) {
	var req ChatRequest
	if err := c.Bind().JSON(&req); err != nil {
		return nil, handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request")
	}
	return &req, nil
}
