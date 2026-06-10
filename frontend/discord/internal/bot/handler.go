package bot

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/bwmarrin/discordgo"
)

// ChatRequest defines the request body for the backend chat endpoint.
type ChatRequest struct {
	Message   string `json:"message"`
	Model     string `json:"model"`
	Mode      string `json:"mode"`
	MissionID string `json:"missionId"`
}

// StreamPacket defines the structure of each JSON line in the SSE stream.
type StreamPacket struct {
	Type    string `json:"type"`
	Content string `json:"content"`
}

// messageCreate receives all message events from the Discord gateway.
func (b *Bot) messageCreate(s *discordgo.Session, m *discordgo.MessageCreate) {
	// Ignore messages from the bot itself.
	if m.Author.ID == s.State.User.ID {
		return
	}

	// Trigger a typing indicator to let the user know the bot is working.
	_ = s.ChannelTyping(m.ChannelID)

	// Build the chat request payload
	reqBody := ChatRequest{
		Message:   m.Content,
		Model:     "gemini-2.5-flash", // Default fallback model
		Mode:      "agent",            // Use 'agent' mode to access the backend orchestrator
		MissionID: m.ChannelID,        // Channel ID acts as the session/mission identifier
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		log.Printf("Failed to marshal chat request: %v", err)
		_, _ = s.ChannelMessageSend(m.ChannelID, "Maaf, terjadi kesalahan saat menyiapkan request ke Agent.")
		return
	}

	// Send request to the Go Backend
	backendURL := fmt.Sprintf("%s/api/v1/chat", b.BackendURL)
	req, err := http.NewRequest("POST", backendURL, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Failed to create HTTP request: %v", err)
		_, _ = s.ChannelMessageSend(m.ChannelID, "Gagal menghubungkan ke backend.")
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Backend HTTP request failed: %v", err)
		_, _ = s.ChannelMessageSend(m.ChannelID, "Backend tidak merespon, pastikan backend server Anda menyala.")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Backend returned status: %d", resp.StatusCode)
		_, _ = s.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Gagal memproses request. Status: %d", resp.StatusCode))
		return
	}

	// Process the SSE stream
	var responseBuilder strings.Builder
	scanner := bufio.NewScanner(resp.Body)

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}

		dataJSON := strings.TrimPrefix(line, "data:")
		dataJSON = strings.TrimSpace(dataJSON)
		if dataJSON == "" {
			continue
		}

		var packet StreamPacket
		if err := json.Unmarshal([]byte(dataJSON), &packet); err == nil {
			if packet.Type == "content" {
				responseBuilder.WriteString(packet.Content)
			}
		}
	}

	finalResponse := strings.TrimSpace(responseBuilder.String())
	if finalResponse == "" {
		finalResponse = "Agent tidak memberikan respon."
	}

	// Discord has a 2000 character limit for single messages.
	// Truncate response if it exceeds limit.
	if len(finalResponse) > 2000 {
		finalResponse = finalResponse[:1990] + "... (truncated)"
	}

	_, err = s.ChannelMessageSend(m.ChannelID, finalResponse)
	if err != nil {
		log.Printf("Failed to send message to Discord: %v", err)
	}
}
