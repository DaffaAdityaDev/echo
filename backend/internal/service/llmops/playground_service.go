package llmops

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"echo-backend/internal/service"
)

type PlaygroundResult struct {
	Model     string `json:"model"`
	Content   string `json:"content"`
	LatencyMS int    `json:"latency_ms"`
	Tokens    int    `json:"tokens"`
	Status    string `json:"status"`
	Error     string `json:"error,omitempty"`
}

type PlaygroundRequest struct {
	Prompt    string            `json:"prompt"`
	Variables map[string]string `json:"variables"`
	Models    []string          `json:"models"`
}

type PlaygroundService interface {
	RunPlayground(ctx context.Context, req PlaygroundRequest) ([]PlaygroundResult, error)
}

type playgroundService struct {
	modelSvc  *service.ModelService
	agentURL  string
	authToken string
	client    *http.Client
}

func NewPlaygroundService(modelSvc *service.ModelService, agentURL, authToken string) PlaygroundService {
	if authToken == "" {
		authToken = "default-internal-token-secret"
	}
	return &playgroundService{
		modelSvc:  modelSvc,
		agentURL:  agentURL,
		authToken: authToken,
		client:    &http.Client{Timeout: 35 * time.Second},
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

func (s *playgroundService) RunPlayground(ctx context.Context, req PlaygroundRequest) ([]PlaygroundResult, error) {
	prompt, err := substituteVariables(req.Prompt, req.Variables)
	if err != nil {
		return nil, err
	}

	if len(req.Models) == 0 {
		return nil, fmt.Errorf("no models selected — pilih minimal satu model")
	}

	results := make([]PlaygroundResult, len(req.Models))
	var wg sync.WaitGroup

	for i, modelID := range req.Models {
		wg.Add(1)
		go func(idx int, id string) {
			defer wg.Done()
			results[idx] = s.runModel(ctx, id, prompt)
		}(i, modelID)
	}

	wg.Wait()
	return results, nil
}

func (s *playgroundService) runModel(ctx context.Context, modelID, prompt string) PlaygroundResult {
	providerCfg, err := s.modelSvc.ResolveModel(modelID)
	if err != nil {
		return PlaygroundResult{
			Model:  modelID,
			Status: "error",
			Error:  fmt.Sprintf("Unknown model: %s", modelID),
		}
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
		"features": []string{},
		"skills":   []string{},
		"config": map[string]any{
			"harness": map[string]any{
				"maxIterations": 5,
			},
		},
	}

	bodyBytes, _ := json.Marshal(agentPayload)

	modelCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(modelCtx, "POST", s.agentURL+"/api/generate-mission", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return PlaygroundResult{
			Model:  modelID,
			Status: "error",
			Error:  fmt.Sprintf("Failed to build request: %v", err),
		}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", s.authToken)

	start := time.Now()
	resp, err := s.client.Do(req)
	if err != nil {
		return PlaygroundResult{
			Model:  modelID,
			Status: "error",
			Error:  fmt.Sprintf("Agent unreachable: %v", err),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return PlaygroundResult{
			Model:  modelID,
			Status: "error",
			Error:  fmt.Sprintf("Agent returned status %d: %s", resp.StatusCode, string(respBody)),
		}
	}

	content, agentErr := consumeSSEStream(resp.Body)
	latency := int(time.Since(start).Milliseconds())

	result := PlaygroundResult{
		Model:     modelID,
		Content:   content,
		LatencyMS: latency,
		Tokens:    len(content) / 4,
		Status:    "success",
	}

	if agentErr != "" {
		result.Status = "error"
		result.Error = agentErr
	}

	return result
}

type ssePacket struct {
	Type    string `json:"type"`
	Content string `json:"content"`
}

func consumeSSEStream(body io.Reader) (string, string) {
	var content strings.Builder
	var agentErr string
	scanner := bufio.NewScanner(body)
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
		case "error":
			if agentErr == "" {
				agentErr = packet.Content
			}
		case "turn_complete":
			return content.String(), agentErr
		}
	}

	if err := scanner.Err(); err != nil {
		return content.String(), fmt.Sprintf("Stream read error: %v", err)
	}

	return content.String(), agentErr
}
