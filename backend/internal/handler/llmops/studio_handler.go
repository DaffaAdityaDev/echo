package llmops

import (
	"bufio"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/service/llmops"
	"github.com/gofiber/fiber/v3"
)

type StudioHandler struct {
	playgroundSvc llmops.PlaygroundService
}

func NewStudioHandler(playgroundSvc llmops.PlaygroundService) *StudioHandler {
	return &StudioHandler{playgroundSvc: playgroundSvc}
}

// HandleRunPlayground godoc
// @Summary Run LLM playground
// @Description Streams multi-model prompt comparison results as Server-Sent Events
// @Tags Studio
// @Accept json
// @Produce text/event-stream
// @Security BearerAuth
// @Param request body llmops.PlaygroundRequest true "Playground payload"
// @Success 200 {string} string "Event stream"
// @Failure 400 {object} map[string]string
// @Router /api/v1/studio/playground [post]
func (h *StudioHandler) HandleRunPlayground(c fiber.Ctx) error {
	var req llmops.PlaygroundRequest
	if err := c.Bind().Body(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request payload")
	}

	if strings.TrimSpace(req.Prompt) == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Prompt is required")
	}

	if userIDStr, ok := c.Locals("user_id").(string); ok && userIDStr != "" {
		if uid, err := strconv.Atoi(userIDStr); err == nil {
			req.UserID = uid
		}
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
