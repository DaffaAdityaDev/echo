package llmops

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	aimodelSvc "echo-backend/internal/service/aimodel"
)

type StreamResult struct {
	Model     string `json:"model"`
	Content   string `json:"content,omitempty"`
	Reasoning string `json:"reasoning,omitempty"`
	Event     string `json:"event"`
	Error     string `json:"error,omitempty"`
	LatencyMS int    `json:"latency_ms,omitempty"`
	Tokens    int    `json:"tokens,omitempty"`
}

type PlaygroundRequest struct {
	Prompt    string            `json:"prompt"`
	Variables map[string]string `json:"variables"`
	Models    []string          `json:"models"`
	Features  []string          `json:"features,omitempty"`
	Skills    []string          `json:"skills,omitempty"`
	UserID    int               `json:"-"`
}

type PlaygroundService interface {
	StreamPlayground(ctx context.Context, req PlaygroundRequest, results chan<- StreamResult) error
}

type playgroundService struct {
	modelSvc  *aimodelSvc.Service
	agentURL  string
	authToken string
	client    *http.Client
}

func NewPlaygroundService(modelSvc *aimodelSvc.Service, agentURL, authToken string) PlaygroundService {
	if authToken == "" {
		authToken = "default-internal-token-secret"
	}
	return &playgroundService{
		modelSvc:  modelSvc,
		agentURL:  agentURL,
		authToken: authToken,
		client:    &http.Client{},
	}
}

var variablePattern = regexp.MustCompile(`\{\{(\w+)\}\}`)

func substituteVariables(prompt string, vars map[string]string) (string, error) {
	matches := variablePattern.FindAllStringSubmatch(prompt, -1)
	for _, m := range matches {
		placeholder := m[0]
		varName := m[1]
		val, ok := vars[varName]
		if !ok {
			return "", fmt.Errorf("missing value for variable '{{%s}}'", varName)
		}
		prompt = strings.ReplaceAll(prompt, placeholder, val)
	}
	return prompt, nil
}

func (s *playgroundService) StreamPlayground(ctx context.Context, req PlaygroundRequest, results chan<- StreamResult) error {
	prompt, err := substituteVariables(req.Prompt, req.Variables)
	if err != nil {
		return err
	}

	if len(req.Models) == 0 {
		return fmt.Errorf("no models selected — pilih minimal satu model")
	}

	var wg sync.WaitGroup
	for _, modelID := range req.Models {
		wg.Add(1)
		go func(id string, feats, skls []string, uid int) {
			defer wg.Done()
			s.runModelStream(ctx, id, prompt, results, feats, skls, uid)
		}(modelID, req.Features, req.Skills, req.UserID)
	}

	wg.Wait()
	select {
	case results <- StreamResult{Event: "complete"}:
	case <-ctx.Done():
	}
	return nil
}

func (s *playgroundService) runModelStream(ctx context.Context, modelID, prompt string, results chan<- StreamResult, features, skills []string, userID int) {
	providerCfg, err := s.modelSvc.ResolveProviderConfig(userID, modelID)
	if err != nil {
		select {
		case results <- StreamResult{
			Model: modelID, Event: "error",
			Error: fmt.Sprintf("Provider config error: %s", err.Error()),
		}:
		case <-ctx.Done():
		}
		return
	}

	agentPayload := map[string]any{
		"provider_config": map[string]any{
			"type":     providerCfg.Type,
			"base_url": providerCfg.BaseURL,
			"api_key":  providerCfg.APIKey,
			"model":    providerCfg.Model,
		},
		"prompt":   prompt,
		"strategy": "agent",
		"config": map[string]any{
			"harness": map[string]any{
				"maxIterations": 5,
			},
		},
	}
	if len(features) > 0 {
		agentPayload["features"] = features
	}
	if len(skills) > 0 {
		agentPayload["skills"] = skills
	}

	bodyBytes, err := json.Marshal(agentPayload)
	if err != nil {
		log.Printf("[playground stream] failed to marshal payload for %s: %v", modelID, err)
	}
	log.Printf("[playground stream] agent payload for %s: %s", modelID, string(bodyBytes))

	modelCtx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(modelCtx, "POST", s.agentURL+"/api/generate-mission", bytes.NewBuffer(bodyBytes))
	if err != nil {
		select {
		case results <- StreamResult{
			Model: modelID, Event: "error",
			Error: fmt.Sprintf("Failed to build request: %v", err),
		}:
		case <-ctx.Done():
		}
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", s.authToken)

	start := time.Now()
	resp, err := s.client.Do(req)
	if err != nil {
		select {
		case results <- StreamResult{
			Model: modelID, Event: "error",
			Error: fmt.Sprintf("Agent unreachable: %v", err),
		}:
		case <-ctx.Done():
		}
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		select {
		case results <- StreamResult{
			Model: modelID, Event: "error",
			Error: fmt.Sprintf("Agent returned status %d: %s", resp.StatusCode, string(respBody)),
		}:
		case <-ctx.Done():
		}
		return
	}

	var content strings.Builder
	var reasoning strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")
		data = strings.TrimSpace(data)

		var packet ssePacket
		if err := json.Unmarshal([]byte(data), &packet); err != nil {
			continue
		}

		switch packet.Type {
		case "content":
			content.WriteString(packet.Content)
			select {
			case results <- StreamResult{
				Model:   modelID,
				Event:   "content",
				Content: packet.Content,
			}:
			case <-ctx.Done():
				return
			}
		case "reasoning":
			reasoning.WriteString(packet.Content)
			select {
			case results <- StreamResult{
				Model:     modelID,
				Event:     "reasoning",
				Reasoning: packet.Content,
			}:
			case <-ctx.Done():
				return
			}
		case "error":
			select {
			case results <- StreamResult{
				Model: modelID, Event: "error",
				Error: packet.Content,
			}:
			case <-ctx.Done():
			}
			return
		case "turn_complete":
			latency := int(time.Since(start).Milliseconds())
			select {
			case results <- StreamResult{
				Model:     modelID,
				Event:     "done",
				Content:   content.String(),
				Reasoning: reasoning.String(),
				LatencyMS: latency,
				Tokens:    content.Len()/4 + reasoning.Len()/4,
			}:
			case <-ctx.Done():
			}
			return
		}
	}

	if err := scanner.Err(); err != nil {
		select {
		case results <- StreamResult{
			Model: modelID, Event: "error",
			Error: fmt.Sprintf("Stream read error: %v", err),
		}:
		case <-ctx.Done():
		}
		return
	}

	latency := int(time.Since(start).Milliseconds())
	select {
	case results <- StreamResult{
		Model:     modelID,
		Event:     "done",
		Content:   content.String(),
		LatencyMS: latency,
		Tokens:    content.Len()/4 + reasoning.Len()/4,
	}:
	case <-ctx.Done():
	}
}

type ssePacket struct {
	Type    string `json:"type"`
	Content string `json:"content"`
}


