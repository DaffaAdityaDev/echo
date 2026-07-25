package llmops

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"echo-backend/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ShadowRepository interface {
	InsertShadowRun(ctx context.Context, sr *models.ShadowRun) error
	GetCandidateVersionByName(ctx context.Context, tenantID, templateName string) (*models.PromptVersion, error)
	ListShadowRuns(ctx context.Context, templateID string, limit int) ([]models.ShadowRun, error)
}

type shadowRepository struct {
	pool *pgxpool.Pool
}

func NewShadowRepository(pool *pgxpool.Pool) ShadowRepository {
	return &shadowRepository{pool: pool}
}

func (r *shadowRepository) InsertShadowRun(ctx context.Context, sr *models.ShadowRun) error {
	query := `
		INSERT INTO shadow_runs (template_id, live_version_id, candidate_version_id, user_query,
			live_output, shadow_output, live_cost_usd, shadow_cost_usd, live_latency_ms, shadow_latency_ms)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at
	`
	err := r.pool.QueryRow(ctx, query,
		sr.TemplateID, sr.LiveVersionID, sr.CandidateVersionID, sr.UserQuery,
		sr.LiveOutput, sr.ShadowOutput, sr.LiveCostUSD, sr.ShadowCostUSD,
		sr.LiveLatencyMS, sr.ShadowLatencyMS,
	).Scan(&sr.ID, &sr.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert shadow run: %w", err)
	}
	return nil
}

func (r *shadowRepository) GetCandidateVersionByName(ctx context.Context, tenantID, templateName string) (*models.PromptVersion, error) {
	query := `
		SELECT v.id, v.template_id, v.version, v.system_prompt, v.bound_tools, v.variables, v.status, v.created_by, v.created_at
		FROM prompt_versions v
		JOIN prompt_templates t ON t.id = v.template_id
		WHERE t.tenant_id = $1 AND t.name = $2 AND v.status = 'shadow'
		ORDER BY v.version DESC LIMIT 1
	`
	v := &models.PromptVersion{}
	var toolsBytes, varsBytes []byte
	err := r.pool.QueryRow(ctx, query, tenantID, templateName).Scan(
		&v.ID, &v.TemplateID, &v.Version, &v.SystemPrompt, &toolsBytes, &varsBytes, &v.Status, &v.CreatedBy, &v.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get candidate version by name: %w", err)
	}
	_ = json.Unmarshal(toolsBytes, &v.BoundTools)
	_ = json.Unmarshal(varsBytes, &v.Variables)
	return v, nil
}

func (r *shadowRepository) ListShadowRuns(ctx context.Context, templateID string, limit int) ([]models.ShadowRun, error) {
	if limit <= 0 {
		limit = 20
	}
	query := `SELECT id, template_id, live_version_id, candidate_version_id, user_query, live_output, shadow_output, live_cost_usd, shadow_cost_usd, live_latency_ms, shadow_latency_ms, created_at FROM shadow_runs WHERE template_id = $1 ORDER BY created_at DESC LIMIT $2`
	rows, err := r.pool.Query(ctx, query, templateID, limit)
	if err != nil {
		return nil, fmt.Errorf("list shadow runs: %w", err)
	}
	defer rows.Close()

	var runs []models.ShadowRun
	for rows.Next() {
		var sr models.ShadowRun
		err := rows.Scan(&sr.ID, &sr.TemplateID, &sr.LiveVersionID, &sr.CandidateVersionID, &sr.UserQuery,
			&sr.LiveOutput, &sr.ShadowOutput, &sr.LiveCostUSD, &sr.ShadowCostUSD, &sr.LiveLatencyMS, &sr.ShadowLatencyMS, &sr.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan shadow run: %w", err)
		}
		runs = append(runs, sr)
	}
	return runs, nil
}
