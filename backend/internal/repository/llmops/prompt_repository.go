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

type PromptRepository interface {
	CreateTemplate(ctx context.Context, tenantID, name, desc string) (*models.PromptTemplate, error)
	GetTemplateByName(ctx context.Context, tenantID, name string) (*models.PromptTemplate, error)
	ListTemplates(ctx context.Context, tenantID string) ([]models.PromptTemplate, error)
	CreateVersion(ctx context.Context, v *models.PromptVersion) (*models.PromptVersion, error)
	GetVersion(ctx context.Context, templateID string, version int) (*models.PromptVersion, error)
	GetActiveVersion(ctx context.Context, templateID string) (*models.PromptVersion, error)
	GetActiveVersionByName(ctx context.Context, tenantID, name string) (*models.PromptVersion, error)
	ListVersions(ctx context.Context, templateID string) ([]models.PromptVersion, error)
	PromoteVersion(ctx context.Context, templateID string, version int, actor string) error
	RollbackVersion(ctx context.Context, templateID string, targetVersion int, actor string) error
}

type promptRepository struct {
	pool *pgxpool.Pool
}

func NewPromptRepository(pool *pgxpool.Pool) PromptRepository {
	return &promptRepository{pool: pool}
}

func (r *promptRepository) ListTemplates(ctx context.Context, tenantID string) ([]models.PromptTemplate, error) {
	query := `
		SELECT id, tenant_id, name, COALESCE(description, ''), COALESCE(active_version, 1), created_at, updated_at
		FROM prompt_templates WHERE tenant_id = $1 ORDER BY updated_at DESC
	`
	rows, err := r.pool.Query(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list templates: %w", err)
	}
	defer rows.Close()

	var templates []models.PromptTemplate
	for rows.Next() {
		var t models.PromptTemplate
		if err := rows.Scan(&t.ID, &t.TenantID, &t.Name, &t.Description, &t.ActiveVersion, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan template row: %w", err)
		}
		templates = append(templates, t)
	}
	return templates, nil
}

func (r *promptRepository) CreateTemplate(ctx context.Context, tenantID, name, desc string) (*models.PromptTemplate, error) {
	query := `
		INSERT INTO prompt_templates (tenant_id, name, description)
		VALUES ($1, $2, $3)
		RETURNING id, tenant_id, name, description, active_version, created_at, updated_at
	`
	t := &models.PromptTemplate{}
	err := r.pool.QueryRow(ctx, query, tenantID, name, desc).Scan(
		&t.ID, &t.TenantID, &t.Name, &t.Description, &t.ActiveVersion, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create template: %w", err)
	}
	return t, nil
}

func (r *promptRepository) GetTemplateByName(ctx context.Context, tenantID, name string) (*models.PromptTemplate, error) {
	query := `
		SELECT id, tenant_id, name, description, active_version, created_at, updated_at
		FROM prompt_templates WHERE tenant_id = $1 AND name = $2
	`
	t := &models.PromptTemplate{}
	err := r.pool.QueryRow(ctx, query, tenantID, name).Scan(
		&t.ID, &t.TenantID, &t.Name, &t.Description, &t.ActiveVersion, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get template by name: %w", err)
	}
	return t, nil
}

func (r *promptRepository) CreateVersion(ctx context.Context, v *models.PromptVersion) (*models.PromptVersion, error) {
	toolsJSON, _ := json.Marshal(v.BoundTools)
	varsJSON, _ := json.Marshal(v.Variables)

	query := `
		INSERT INTO prompt_versions (template_id, version, system_prompt, bound_tools, variables, status, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	err := r.pool.QueryRow(ctx, query, v.TemplateID, v.Version, v.SystemPrompt, toolsJSON, varsJSON, v.Status, v.CreatedBy).
		Scan(&v.ID, &v.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create version: %w", err)
	}
	return v, nil
}

func (r *promptRepository) GetVersion(ctx context.Context, templateID string, version int) (*models.PromptVersion, error) {
	query := `
		SELECT id, template_id, version, system_prompt, bound_tools, variables, status, created_by, created_at
		FROM prompt_versions WHERE template_id = $1 AND version = $2
	`
	v := &models.PromptVersion{}
	var toolsBytes, varsBytes []byte
	err := r.pool.QueryRow(ctx, query, templateID, version).Scan(
		&v.ID, &v.TemplateID, &v.Version, &v.SystemPrompt, &toolsBytes, &varsBytes, &v.Status, &v.CreatedBy, &v.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get version: %w", err)
	}
	_ = json.Unmarshal(toolsBytes, &v.BoundTools)
	_ = json.Unmarshal(varsBytes, &v.Variables)
	return v, nil
}

func (r *promptRepository) GetActiveVersion(ctx context.Context, templateID string) (*models.PromptVersion, error) {
	query := `
		SELECT v.id, v.template_id, v.version, v.system_prompt, v.bound_tools, v.variables, v.status, v.created_by, v.created_at
		FROM prompt_versions v
		JOIN prompt_templates t ON t.id = v.template_id AND t.active_version = v.version
		WHERE t.id = $1
	`
	v := &models.PromptVersion{}
	var toolsBytes, varsBytes []byte
	err := r.pool.QueryRow(ctx, query, templateID).Scan(
		&v.ID, &v.TemplateID, &v.Version, &v.SystemPrompt, &toolsBytes, &varsBytes, &v.Status, &v.CreatedBy, &v.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get active version: %w", err)
	}
	_ = json.Unmarshal(toolsBytes, &v.BoundTools)
	_ = json.Unmarshal(varsBytes, &v.Variables)
	return v, nil
}

func (r *promptRepository) GetActiveVersionByName(ctx context.Context, tenantID, name string) (*models.PromptVersion, error) {
	query := `
		SELECT v.id, v.template_id, v.version, v.system_prompt, v.bound_tools, v.variables, v.status, v.created_by, v.created_at
		FROM prompt_versions v
		JOIN prompt_templates t ON t.id = v.template_id AND t.active_version = v.version
		WHERE t.tenant_id = $1 AND t.name = $2
	`
	v := &models.PromptVersion{}
	var toolsBytes, varsBytes []byte
	err := r.pool.QueryRow(ctx, query, tenantID, name).Scan(
		&v.ID, &v.TemplateID, &v.Version, &v.SystemPrompt, &toolsBytes, &varsBytes, &v.Status, &v.CreatedBy, &v.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get active version by name: %w", err)
	}
	_ = json.Unmarshal(toolsBytes, &v.BoundTools)
	_ = json.Unmarshal(varsBytes, &v.Variables)
	return v, nil
}

func (r *promptRepository) ListVersions(ctx context.Context, templateID string) ([]models.PromptVersion, error) {
	query := `SELECT id, template_id, version, system_prompt, bound_tools, variables, status, created_by, created_at FROM prompt_versions WHERE template_id = $1 ORDER BY version DESC`
	rows, err := r.pool.Query(ctx, query, templateID)
	if err != nil {
		return nil, fmt.Errorf("list versions: %w", err)
	}
	defer rows.Close()

	var versions []models.PromptVersion
	for rows.Next() {
		var v models.PromptVersion
		var toolsBytes, varsBytes []byte
		if err := rows.Scan(&v.ID, &v.TemplateID, &v.Version, &v.SystemPrompt, &toolsBytes, &varsBytes, &v.Status, &v.CreatedBy, &v.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan version row: %w", err)
		}
		_ = json.Unmarshal(toolsBytes, &v.BoundTools)
		_ = json.Unmarshal(varsBytes, &v.Variables)
		versions = append(versions, v)
	}
	return versions, nil
}

func (r *promptRepository) PromoteVersion(ctx context.Context, templateID string, version int, actor string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("tx begin: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `UPDATE prompt_templates SET active_version = $1, updated_at = NOW() WHERE id = $2`, version, templateID)
	if err != nil {
		return fmt.Errorf("update template active version: %w", err)
	}

	_, err = tx.Exec(ctx, `UPDATE prompt_versions SET status = 'production' WHERE template_id = $1 AND version = $2`, templateID, version)
	if err != nil {
		return fmt.Errorf("update version status: %w", err)
	}

	return tx.Commit(ctx)
}

func (r *promptRepository) RollbackVersion(ctx context.Context, templateID string, targetVersion int, actor string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("tx begin: %w", err)
	}
	defer tx.Rollback(ctx)

	var currentActive int
	err = tx.QueryRow(ctx, `SELECT active_version FROM prompt_templates WHERE id = $1`, templateID).Scan(&currentActive)
	if err != nil {
		return fmt.Errorf("fetch current active version: %w", err)
	}

	if currentActive != targetVersion {
		_, err = tx.Exec(ctx, `UPDATE prompt_versions SET status = 'rolled_back' WHERE template_id = $1 AND version = $2`, templateID, currentActive)
		if err != nil {
			return fmt.Errorf("mark former active version rolled_back: %w", err)
		}
	}

	_, err = tx.Exec(ctx, `UPDATE prompt_templates SET active_version = $1, updated_at = NOW() WHERE id = $2`, targetVersion, templateID)
	if err != nil {
		return fmt.Errorf("update template active pointer: %w", err)
	}

	_, err = tx.Exec(ctx, `UPDATE prompt_versions SET status = 'production' WHERE template_id = $1 AND version = $2`, templateID, targetVersion)
	if err != nil {
		return fmt.Errorf("set target version production: %w", err)
	}

	return tx.Commit(ctx)
}
