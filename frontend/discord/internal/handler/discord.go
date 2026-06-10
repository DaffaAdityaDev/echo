package handler

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"magi/internal/models"
	"net/http"
	"strings"
	"sync"

	"github.com/bwmarrin/discordgo"
)

type DiscordJob struct {
	Session *discordgo.Session
	Event   *discordgo.MessageCreate
}

type DiscordHandler struct {
	Cfg           *models.Config
	JobQueue      chan *DiscordJob
	ChannelModels sync.Map // Thread-safe storage: channelID (string) -> modelName (string)
	ChannelModes  sync.Map // Thread-safe storage: channelID (string) -> modeName (string)
}

type ChatRequest struct {
	Message   string `json:"message"`
	Model     string `json:"model"`
	Mode      string `json:"mode"`
	MissionID string `json:"missionId"`
}

type StreamPacket struct {
	Type    string `json:"type"`
	Content string `json:"content"`
}

func NewDiscordHandler(cfg *models.Config, queueSize int) *DiscordHandler {
	return &DiscordHandler{
		Cfg:      cfg,
		JobQueue: make(chan *DiscordJob, queueSize),
	}
}

// Start launches a specified number of worker goroutines to process incoming chat jobs from the queue.
func (h *DiscordHandler) Start(ctx context.Context, numWorkers int) {
	for i := 0; i < numWorkers; i++ {
		go h.worker(ctx)
	}
}

func (h *DiscordHandler) worker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case job, ok := <-h.JobQueue:
			if !ok {
				return
			}
			h.processChat(job.Session, job.Event)
		}
	}
}

// OnMessageCreate is the callback for Discord MessageCreate events.
// It acts as a producer, pushing jobs into the worker pool queue.
func (h *DiscordHandler) OnMessageCreate(s *discordgo.Session, m *discordgo.MessageCreate) {
	// Ignore messages from the bot itself.
	if m.Author.ID == s.State.User.ID {
		return
	}

	// Check if the bot is mentioned
	isMentioned := false
	for _, mention := range m.Mentions {
		if mention.ID == s.State.User.ID {
			isMentioned = true
			break
		}
	}

	// Check if the message starts with a command prefix '!'
	hasPrefix := strings.HasPrefix(m.Content, "!")

	// Only process the message if the bot was mentioned or it starts with '!'
	if !isMentioned && !hasPrefix {
		return
	}

	// Enqueue the job. If queue is full, reply with a busy message to throttle requests.
	select {
	case h.JobQueue <- &DiscordJob{Session: s, Event: m}:
		// Trigger a typing indicator to acknowledge receipt.
		_ = s.ChannelTyping(m.ChannelID)
	default:
		_, _ = s.ChannelMessageSend(m.ChannelID, "Antrean penuh. Mohon coba beberapa saat lagi.")
	}
}

// OnInteractionCreate receives slash commands and interactive components (like dropdown lists).
func (h *DiscordHandler) OnInteractionCreate(s *discordgo.Session, i *discordgo.InteractionCreate) {
	// 1. Handle Slash Commands
	if i.Type == discordgo.InteractionApplicationCommand {
		switch i.ApplicationCommandData().Name {
		case "model":
			h.handleSlashModel(s, i)
		case "mode":
			h.handleSlashMode(s, i)
		}
		return
	}

	// 2. Handle Dropdown Menu selections
	if i.Type == discordgo.InteractionMessageComponent {
		switch i.MessageComponentData().CustomID {
		case "select_model":
			h.handleDropdownSelection(s, i)
		case "select_mode":
			h.handleModeDropdownSelection(s, i)
		}
		return
	}
}

// ModelInfo defines the structure of each model item returned by the backend.
type ModelInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ModelsResponse defines the JSON schema returned by the backend models endpoint.
type ModelsResponse struct {
	Models []ModelInfo `json:"models"`
}

// handleSlashModel responds to the /model slash command by displaying a Select Menu (dropdown).
func (h *DiscordHandler) handleSlashModel(s *discordgo.Session, i *discordgo.InteractionCreate) {
	// Fetch available models from Go Backend
	modelsList, err := h.fetchModels()
	if err != nil {
		log.Printf("Error fetching models: %v", err)
		_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "Gagal memuat daftar model dari backend.",
				Flags:   discordgo.MessageFlagsEphemeral,
			},
		})
		return
	}

	// Build dropdown options
	var options []discordgo.SelectMenuOption
	for _, mdl := range modelsList {
		options = append(options, discordgo.SelectMenuOption{
			Label:       mdl.Name,
			Value:       mdl.ID,
			Description: fmt.Sprintf("Gunakan model %s", mdl.ID),
		})
	}

	if len(options) == 0 {
		_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "Tidak ada model yang tersedia saat ini.",
				Flags:   discordgo.MessageFlagsEphemeral,
			},
		})
		return
	}

	// Respond with Select Menu Component
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Content: "Silakan pilih model AI yang ingin diaktifkan di channel ini:",
			Components: []discordgo.MessageComponent{
				discordgo.ActionsRow{
					Components: []discordgo.MessageComponent{
						discordgo.SelectMenu{
							CustomID:    "select_model",
							Placeholder: "Pilih model dari daftar...",
							Options:     options,
						},
					},
				},
			},
		},
	})
}

// handleDropdownSelection receives the selected model and updates the local state.
func (h *DiscordHandler) handleDropdownSelection(s *discordgo.Session, i *discordgo.InteractionCreate) {
	selectedModel := i.MessageComponentData().Values[0]

	// Save selected model for the current channel
	h.ChannelModels.Store(i.ChannelID, selectedModel)

	// Update the interaction message to remove the dropdown and show success confirmation
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseUpdateMessage,
		Data: &discordgo.InteractionResponseData{
			Content:    fmt.Sprintf("Model untuk channel ini berhasil diubah ke: **%s**", selectedModel),
			Components: []discordgo.MessageComponent{}, // Removes the dropdown component
		},
	})
}

// fetchModels calls the Go Backend endpoint to retrieve the supported models list.
func (h *DiscordHandler) fetchModels() ([]ModelInfo, error) {
	backendURL := fmt.Sprintf("%s/api/v1/models", h.Cfg.BackendURL)
	resp, err := http.Get(backendURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("backend returned status: %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var modelsResp ModelsResponse
	if err := json.Unmarshal(bodyBytes, &modelsResp); err != nil {
		return nil, err
	}

	return modelsResp.Models, nil
}

// processChat communicates with the backend, processes the SSE stream, and posts the final reply.
func (h *DiscordHandler) processChat(s *discordgo.Session, m *discordgo.MessageCreate) {
	// Retrieve active model for this channel, fallback to default if not configured
	activeModel := "nvidia/nemotron-3-nano-4b"
	if val, ok := h.ChannelModels.Load(m.ChannelID); ok {
		if modelName, ok := val.(string); ok {
			activeModel = modelName
		}
	}

	activeMode := "agent"
	if val, ok := h.ChannelModes.Load(m.ChannelID); ok {
		if modeName, ok := val.(string); ok {
			activeMode = modeName
		}
	}

	reqBody := ChatRequest{
		Message:   m.Content,
		Model:     activeModel,
		Mode:      activeMode,
		MissionID: m.ChannelID,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		log.Printf("Failed to marshal chat request: %v", err)
		_, _ = s.ChannelMessageSend(m.ChannelID, "Maaf, terjadi kesalahan internal saat menyiapkan pesan.")
		return
	}

	backendURL := fmt.Sprintf("%s/api/v1/chat", h.Cfg.BackendURL)
	req, err := http.NewRequest("POST", backendURL, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Failed to create HTTP request to backend: %v", err)
		_, _ = s.ChannelMessageSend(m.ChannelID, "Gagal membuat koneksi ke service backend.")
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Backend request failed: %v", err)
		_, _ = s.ChannelMessageSend(m.ChannelID, "Backend Agent tidak merespon, pastikan backend service menyala.")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Backend returned status code: %d", resp.StatusCode)
		_, _ = s.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Gagal memproses request. Status: %d", resp.StatusCode))
		return
	}

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

	runes := []rune(finalResponse)
	if len(runes) > 1900 {
		finalResponse = string(runes[:1900]) + "... (truncated)"
	}

	_, err = s.ChannelMessageSend(m.ChannelID, finalResponse)
	if err != nil {
		log.Printf("Failed to send message to Discord: %v", err)
	}
}

// handleSlashMode responds to the /mode slash command.
func (h *DiscordHandler) handleSlashMode(s *discordgo.Session, i *discordgo.InteractionCreate) {
	// Modes list options
	options := []discordgo.SelectMenuOption{
		{
			Label:       "Standard Chat",
			Value:       "standard",
			Description: "Percakapan biasa/general chatbot dengan LLM",
		},
		{
			Label:       "Agent Orchestration",
			Value:       "agent",
			Description: "Mengaktifkan agent otonom dengan tools (default)",
		},
		{
			Label:       "NLAH (Natural Language Agent Harness)",
			Value:       "nlah",
			Description: "Menggunakan mode harness bahasa alami",
		},
	}

	// Respond with Select Menu Component
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Content: "Silakan pilih mode interaksi untuk channel ini:",
			Components: []discordgo.MessageComponent{
				discordgo.ActionsRow{
					Components: []discordgo.MessageComponent{
						discordgo.SelectMenu{
							CustomID:    "select_mode",
							Placeholder: "Pilih mode dari daftar...",
							Options:     options,
						},
					},
				},
			},
		},
	})
}

// handleModeDropdownSelection receives the selected mode and updates the state.
func (h *DiscordHandler) handleModeDropdownSelection(s *discordgo.Session, i *discordgo.InteractionCreate) {
	selectedMode := i.MessageComponentData().Values[0]

	h.ChannelModes.Store(i.ChannelID, selectedMode)

	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseUpdateMessage,
		Data: &discordgo.InteractionResponseData{
			Content:    fmt.Sprintf("Mode interaksi untuk channel ini berhasil diubah ke: **%s**", strings.ToUpper(selectedMode)),
			Components: []discordgo.MessageComponent{}, // Removes the dropdown
		},
	})
}
