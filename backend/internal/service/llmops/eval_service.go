package llmops

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"echo-backend/internal/models"
	"echo-backend/internal/repository/llmops"
)

type EvalService interface {
	CreateDataset(ctx context.Context, dataset *models.EvalDataset) (*models.EvalDataset, error)
	RunEvalSuite(ctx context.Context, versionID, datasetID, executor string) (*models.EvalRun, error)
	GetEvalRunResults(ctx context.Context, runID string) (*models.EvalRun, error)
}

type evalService struct {
	repo              llmops.EvalRepository
	promptRepo        llmops.PromptRepository
	agentServerURL    string
	evaluatorEndpoint string
	evaluatorAPIKey   string
	evaluatorModel    string
	internalAuthToken string
	client            *http.Client
}

func NewEvalService(
	repo llmops.EvalRepository,
	promptRepo llmops.PromptRepository,
	agentServerURL string,
	evaluatorEndpoint string,
	evaluatorAPIKey string,
	evaluatorModel string,
	internalAuthToken string,
) EvalService {
	if evaluatorEndpoint == "" {
		evaluatorEndpoint = "https://api.openai.com/v1/chat/completions"
	}
	if evaluatorModel == "" {
		evaluatorModel = "gpt-4o"
	}
	if internalAuthToken == "" {
		internalAuthToken = "default-internal-token-secret"
	}
	return &evalService{
		repo:              repo,
		promptRepo:        promptRepo,
		agentServerURL:    agentServerURL,
		evaluatorEndpoint: evaluatorEndpoint,
		evaluatorAPIKey:   evaluatorAPIKey,
		evaluatorModel:    evaluatorModel,
		internalAuthToken: internalAuthToken,
		client:            &http.Client{Timeout: 60 * time.Second},
	}
}

func (s *evalService) CreateDataset(ctx context.Context, dataset *models.EvalDataset) (*models.EvalDataset, error) {
	return s.repo.CreateDataset(ctx, dataset)
}

type judgeResult struct {
	ScoreAccuracy int    `json:"score_accuracy"`
	ScoreFormat   int    `json:"score_format"`
	ScoreTools    int    `json:"score_tools"`
	Passed        bool   `json:"passed"`
	Reasoning     string `json:"reasoning"`
}

func (s *evalService) RunEvalSuite(ctx context.Context, versionID, datasetID, executor string) (*models.EvalRun, error) {
	dataset, err := s.repo.GetDataset(ctx, datasetID)
	if err != nil {
		return nil, fmt.Errorf("fetch dataset: %w", err)
	}

	totalCases := len(dataset.TestCases)
	if totalCases == 0 {
		return nil, fmt.Errorf("dataset has no test cases")
	}

	var details []map[string]any
	passedCount := 0
	sumAccuracy, sumFormat, sumTools := 0, 0, 0

	for _, tc := range dataset.TestCases {
		agentOutput, err := s.executeAgentCase(ctx, tc.Input)
		if err != nil {
			agentOutput = fmt.Sprintf("AGENT_ERROR: %v", err)
		}

		judge, err := s.evaluateWithJudge(ctx, tc.Input, tc.ExpectedOutput, agentOutput)
		if err != nil {
			judge = &judgeResult{
				Passed:        false,
				ScoreAccuracy: 0,
				ScoreFormat:   0,
				ScoreTools:    0,
				Reasoning:     fmt.Sprintf("Evaluation failed: %v", err),
			}
		}

		if judge.Passed {
			passedCount++
		}
		sumAccuracy += judge.ScoreAccuracy
		sumFormat += judge.ScoreFormat
		sumTools += judge.ScoreTools

		details = append(details, map[string]any{
			"input":           tc.Input,
			"expected_output": tc.ExpectedOutput,
			"ai_output":       agentOutput,
			"passed":          judge.Passed,
			"score_accuracy":  judge.ScoreAccuracy,
			"score_format":    judge.ScoreFormat,
			"score_tools":     judge.ScoreTools,
			"reasoning":       judge.Reasoning,
		})
	}

	passRate := (passedCount * 100) / totalCases
	avgAccuracy := sumAccuracy / totalCases
	avgFormat := sumFormat / totalCases
	avgTools := sumTools / totalCases

	evalRun := &models.EvalRun{
		PromptVersionID: versionID,
		DatasetID:       &datasetID,
		PassRate:        passRate,
		ScoreAccuracy:   avgAccuracy,
		ScoreFormat:     avgFormat,
		ScoreTools:      avgTools,
		Details:         details,
		ExecutedBy:      executor,
	}

	return s.repo.InsertEvalRun(ctx, evalRun)
}

func (s *evalService) executeAgentCase(ctx context.Context, input string) (string, error) {
	payload := map[string]any{"prompt": input}
	bodyBytes, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", fmt.Sprintf("%s/api/generate-mission", s.agentServerURL), bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", s.internalAuthToken)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return result.Content, nil
}

func (s *evalService) evaluateWithJudge(ctx context.Context, input, expected, aiOutput string) (*judgeResult, error) {
	systemJudgePrompt := `You are an impartial AI LLM-as-a-Judge. Evaluate the AI's response against expected ground truth.
Respond strictly with a single JSON object. Do not include markdown formatting or prose outside the JSON.
Shape:
{
  "score_accuracy": 0-100,
  "score_format": 0-100,
  "score_tools": 0-100,
  "passed": boolean,
  "reasoning": "string explanation"
}`

	judgeUserMessage := fmt.Sprintf("Input Query: %s\nExpected Ground Truth: %s\nAI Output: %s", input, expected, aiOutput)

	payload := map[string]any{
		"model": s.evaluatorModel,
		"messages": []map[string]string{
			{"role": "system", "content": systemJudgePrompt},
			{"role": "user", "content": judgeUserMessage},
		},
		"temperature": 0.0,
	}
	bodyBytes, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", s.evaluatorEndpoint, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create judge HTTP request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if s.evaluatorAPIKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.evaluatorAPIKey))
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("judge LLM network call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("judge LLM returned status %d", resp.StatusCode)
	}

	var openAIResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&openAIResp); err != nil {
		return nil, fmt.Errorf("decode judge response body: %w", err)
	}

	if len(openAIResp.Choices) == 0 {
		return nil, fmt.Errorf("judge LLM returned empty choices")
	}

	rawContent := openAIResp.Choices[0].Message.Content
	cleanJSON := cleanJSONResponse(rawContent)

	res := &judgeResult{}
	if err := json.Unmarshal([]byte(cleanJSON), res); err != nil {
		return nil, fmt.Errorf("parse judge JSON output: %w (raw response: %s)", err, rawContent)
	}

	return res, nil
}

func cleanJSONResponse(raw string) string {
	cleaned := strings.TrimSpace(raw)
	if strings.HasPrefix(cleaned, "```json") {
		cleaned = strings.TrimPrefix(cleaned, "```json")
		cleaned = strings.TrimSuffix(cleaned, "```")
	} else if strings.HasPrefix(cleaned, "```") {
		cleaned = strings.TrimPrefix(cleaned, "```")
		cleaned = strings.TrimSuffix(cleaned, "```")
	}
	return strings.TrimSpace(cleaned)
}

func (s *evalService) GetEvalRunResults(ctx context.Context, runID string) (*models.EvalRun, error) {
	return s.repo.GetEvalRun(ctx, runID)
}
