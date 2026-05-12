package handler

import (
	"bufio"
	"bytes"
	"echo-backend/internal/models"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gofiber/fiber/v3"
)

type ChatHandler struct {
	Cfg *models.Config
}

func NewChatHandler(cfg *models.Config) *ChatHandler {
	return &ChatHandler{Cfg: cfg}
}

type HistoryMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Message string           `json:"message"`
	Model   string           `json:"model"`
	Mode    string           `json:"mode"`
	History []HistoryMessage `json:"history"`
}

func (h *ChatHandler) HandleChat(c fiber.Ctx) error {
	var req ChatRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Forward the mode to the agent via query param
	agentURL := fmt.Sprintf("%s/api/generate-mission?mode=%s", h.Cfg.AgentHTTPURL, req.Mode)

	// Prepare payload for Agent, including conversation history
	payload := map[string]interface{}{
		"user_id": 1,
		"message": req.Message,
		"model":   req.Model,
		"history": req.History,
	}
	jsonPayload, _ := json.Marshal(payload)

	// Create request to Agent
	client := &http.Client{}
	agentReq, err := http.NewRequest("POST", agentURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create request to agent"})
	}
	agentReq.Header.Set("Content-Type", "application/json")

	// Call Agent
	resp, err := client.Do(agentReq)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Agent service unreachable"})
	}

	// Set headers for streaming
	c.Response().Header.Set("Content-Type", "text/event-stream")
	c.Response().Header.Set("Cache-Control", "no-cache")
	c.Response().Header.Set("Connection", "keep-alive")
	c.Response().Header.Set("Transfer-Encoding", "chunked")

	return c.SendStreamWriter(func(w *bufio.Writer) {
		reader := resp.Body
		defer reader.Close()

		buf := make([]byte, 512)
		for {
			n, err := reader.Read(buf)
			if n > 0 {
				if _, err := w.Write(buf[:n]); err != nil {
					break
				}
				if err := w.Flush(); err != nil {
					break
				}
			}
			if err != nil {
				if err != io.EOF {
					fmt.Printf("ERROR: Stream from Agent error: %v\n", err)
				}
				break
			}
		}
	})
}
