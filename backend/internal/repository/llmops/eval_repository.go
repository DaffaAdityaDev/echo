package llmops

import (
	"context"
	"encoding/json"
	"fmt"

	"echo-backend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

type EvalRepository interface {
	CreateDataset(ctx context.Context, dataset *models.EvalDataset) (*models.EvalDataset, error)
	GetDataset(ctx context.Context, id string) (*models.EvalDataset, error)
	InsertEvalRun(ctx context.Context, run *models.EvalRun) (*models.EvalRun, error)
	GetEvalRun(ctx context.Context, id string) (*models.EvalRun, error)
}

type evalRepository struct {
	pool *pgxpool.Pool
}

func NewEvalRepository(pool *pgxpool.Pool) EvalRepository {
	return &evalRepository{pool: pool}
}

func (r *evalRepository) CreateDataset(ctx context.Context, dataset *models.EvalDataset) (*models.EvalDataset, error) {
	casesJSON, _ := json.Marshal(dataset.TestCases)
	query := `
		INSERT INTO eval_datasets (tenant_id, name, description, test_cases, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`
	err := r.pool.QueryRow(ctx, query, dataset.TenantID, dataset.Name, dataset.Description, casesJSON, dataset.CreatedBy).
		Scan(&dataset.ID, &dataset.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create eval dataset: %w", err)
	}
	return dataset, nil
}

func (r *evalRepository) GetDataset(ctx context.Context, id string) (*models.EvalDataset, error) {
	query := `SELECT id, tenant_id, name, description, test_cases, created_by, created_at FROM eval_datasets WHERE id = $1`
	d := &models.EvalDataset{}
	var casesBytes []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(&d.ID, &d.TenantID, &d.Name, &d.Description, &casesBytes, &d.CreatedBy, &d.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get dataset: %w", err)
	}
	_ = json.Unmarshal(casesBytes, &d.TestCases)
	return d, nil
}

func (r *evalRepository) InsertEvalRun(ctx context.Context, run *models.EvalRun) (*models.EvalRun, error) {
	detailsJSON, _ := json.Marshal(run.Details)
	query := `
		INSERT INTO eval_runs (prompt_version_id, dataset_id, pass_rate, score_accuracy, score_format, score_tools, details, executed_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at
	`
	err := r.pool.QueryRow(
		ctx, query,
		run.PromptVersionID, run.DatasetID, run.PassRate,
		run.ScoreAccuracy, run.ScoreFormat, run.ScoreTools, detailsJSON, run.ExecutedBy,
	).Scan(&run.ID, &run.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert eval run: %w", err)
	}
	return run, nil
}

func (r *evalRepository) GetEvalRun(ctx context.Context, id string) (*models.EvalRun, error) {
	query := `SELECT id, prompt_version_id, dataset_id, pass_rate, score_accuracy, score_format, score_tools, details, executed_by, created_at FROM eval_runs WHERE id = $1`
	run := &models.EvalRun{}
	var detailsBytes []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&run.ID, &run.PromptVersionID, &run.DatasetID, &run.PassRate,
		&run.ScoreAccuracy, &run.ScoreFormat, &run.ScoreTools, &detailsBytes, &run.ExecutedBy, &run.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get eval run: %w", err)
	}
	_ = json.Unmarshal(detailsBytes, &run.Details)
	return run, nil
}
