package llmops

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"echo-backend/internal/models"
	shadowrepo "echo-backend/internal/repository/llmops/module/shadow"
)

type ShadowService interface {
	GetCandidateIfActive(ctx context.Context, tenantID, templateName string) (*models.PromptVersion, error)
	ExecuteAndRecordShadowRun(ctx context.Context, livePayload, shadowPayload models.AgentMissionPayload, liveResult models.AgentResult) error
	GetComparisonHistory(ctx context.Context, templateID string, limit int) ([]models.ShadowRun, error)
}

type shadowService struct {
	repo              shadowrepo.Repository
	agentClient       *http.Client
	agentServerURL    string
	internalAuthToken string
}

func NewShadowService(repo shadowrepo.Repository, agentServerURL string, internalAuthToken string) ShadowService {
	if internalAuthToken == "" {
		internalAuthToken = "default-internal-token-secret"
	}
	return &shadowService{
		repo:              repo,
		agentServerURL:    agentServerURL,
		internalAuthToken: internalAuthToken,
		agentClient:       &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *shadowService) GetCandidateIfActive(ctx context.Context, tenantID, templateName string) (*models.PromptVersion, error) {
	return s.repo.GetCandidateVersionByName(ctx, tenantID, templateName)
}

func (s *shadowService) ExecuteAndRecordShadowRun(ctx context.Context, livePayload, shadowPayload models.AgentMissionPayload, liveResult models.AgentResult) error {
	start := time.Now()

	bodyBytes, err := json.Marshal(shadowPayload)
	if err != nil {
		return fmt.Errorf("marshal shadow payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", fmt.Sprintf("%s/api/generate-mission", s.agentServerURL), bytes.NewBuffer(bodyBytes))
	if err != nil {
		return fmt.Errorf("create shadow request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", s.internalAuthToken)

	resp, err := s.agentClient.Do(req)
	shadowLatency := int(time.Since(start).Milliseconds())

	shadowOutput := ""
	if err == nil && resp != nil {
		defer resp.Body.Close()
		var shadowResp struct {
			Content string  `json:"content"`
			Cost    float64 `json:"cost_usd"`
		}
		if json.NewDecoder(resp.Body).Decode(&shadowResp) == nil {
			shadowOutput = shadowResp.Content
		}
	}

	sr := &models.ShadowRun{
		TemplateID:         shadowPayload.TemplateID,
		LiveVersionID:      livePayload.PromptVersionID,
		CandidateVersionID: shadowPayload.PromptVersionID,
		UserQuery:          livePayload.Prompt,
		LiveOutput:         liveResult.Content,
		ShadowOutput:       shadowOutput,
		LiveCostUSD:        liveResult.CostUSD,
		ShadowCostUSD:      0.0,
		LiveLatencyMS:      liveResult.LatencyMS,
		ShadowLatencyMS:    shadowLatency,
	}

	return s.repo.InsertShadowRun(ctx, sr)
}

func (s *shadowService) GetComparisonHistory(ctx context.Context, templateID string, limit int) ([]models.ShadowRun, error) {
	return s.repo.ListShadowRuns(ctx, templateID, limit)
}
