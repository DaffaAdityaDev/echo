package llmops

import (
	"context"
	"errors"
	"fmt"
	"log"

	"echo-backend/internal/models/llmops"
	propsrepo "echo-backend/internal/repository/llmops/module/props"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/redis/go-redis/v9"
)

type PromptService interface {
	CreatePromptTemplate(ctx context.Context, tenantID, name, desc string) (*llmopsmodel.PromptTemplate, error)
	ListTemplates(ctx context.Context, tenantID string) ([]llmopsmodel.PromptTemplate, error)
	CreateNewVersion(ctx context.Context, templateID, prompt, actor string, tools, vars []string) (*llmopsmodel.PromptVersion, error)
	GetVersion(ctx context.Context, templateID string, version int) (*llmopsmodel.PromptVersion, error)
	GetActivePrompt(ctx context.Context, tenantID, templateName string) (*llmopsmodel.PromptVersion, error)
	PromoteToProduction(ctx context.Context, templateID string, version int, actor string) error
	RollbackToVersion(ctx context.Context, templateID string, targetVersion int, actor string) error
	GetVersionHistory(ctx context.Context, templateID string) ([]llmopsmodel.PromptVersion, error)
}

type promptService struct {
	repo propsrepo.Repository
	rdb  *redis.Client
}

func NewPromptService(repo propsrepo.Repository, rdb *redis.Client) PromptService {
	return &promptService{repo: repo, rdb: rdb}
}

func (s *promptService) ListTemplates(ctx context.Context, tenantID string) ([]llmopsmodel.PromptTemplate, error) {
	return s.repo.ListTemplates(ctx, tenantID)
}

func (s *promptService) CreatePromptTemplate(ctx context.Context, tenantID, name, desc string) (*llmopsmodel.PromptTemplate, error) {
	if name == "" {
		return nil, fmt.Errorf("template name cannot be empty")
	}
	tmpl, err := s.repo.CreateTemplate(ctx, tenantID, name, desc)
	if err != nil {
		return nil, err
	}
	return tmpl, nil
}

func (s *promptService) CreateNewVersion(ctx context.Context, templateID, prompt, actor string, tools, vars []string) (*llmopsmodel.PromptVersion, error) {
	const maxAttempts = 3
	for attempt := 1; ; attempt++ {
		versions, err := s.repo.ListVersions(ctx, templateID)
		if err != nil {
			return nil, fmt.Errorf("list versions: %w", err)
		}

		nextVersion := 1
		if len(versions) > 0 {
			nextVersion = versions[0].Version + 1
		}

		pv := &llmopsmodel.PromptVersion{
			TemplateID:   templateID,
			Version:      nextVersion,
			SystemPrompt: prompt,
			BoundTools:   tools,
			Variables:    vars,
			Status:       "draft",
			CreatedBy:    actor,
		}

		created, err := s.repo.CreateVersion(ctx, pv)
		if err == nil {
			return created, nil
		}

		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
			return nil, fmt.Errorf("create version: %w", err)
		}
		if attempt == maxAttempts {
			return nil, fmt.Errorf("create version: version conflict persists after %d attempts", maxAttempts)
		}
	}
}

func (s *promptService) GetVersion(ctx context.Context, templateID string, version int) (*llmopsmodel.PromptVersion, error) {
	v, err := s.repo.GetVersion(ctx, templateID, version)
	if err != nil || v == nil {
		return nil, fmt.Errorf("prompt version not found: %w", err)
	}
	return v, nil
}

func (s *promptService) GetActivePrompt(ctx context.Context, tenantID, templateName string) (*llmopsmodel.PromptVersion, error) {
	v, err := s.repo.GetActiveVersionByName(ctx, tenantID, templateName)
	if err != nil || v == nil {
		return nil, fmt.Errorf("active prompt version not found: %w", err)
	}
	return v, nil
}

func (s *promptService) PromoteToProduction(ctx context.Context, templateID string, version int, actor string) error {
	err := s.repo.PromoteVersion(ctx, templateID, version, actor)
	if err != nil {
		return err
	}
	s.invalidateActivePromptCache(ctx, templateID)
	return nil
}

func (s *promptService) RollbackToVersion(ctx context.Context, templateID string, targetVersion int, actor string) error {
	err := s.repo.RollbackVersion(ctx, templateID, targetVersion, actor)
	if err != nil {
		return err
	}
	s.invalidateActivePromptCache(ctx, templateID)
	return nil
}

func (s *promptService) invalidateActivePromptCache(ctx context.Context, templateID string) {
	if s.rdb == nil {
		return
	}
	tmpl, err := s.repo.GetTemplateByID(ctx, templateID)
	if err != nil || tmpl == nil {
		return
	}
	key := promptCacheKey(tmpl.TenantID, tmpl.Name)
	if err := s.rdb.Del(ctx, key).Err(); err != nil {
		log.Printf("[LLMOPS] Failed to invalidate prompt cache key %s: %v", key, err)
	}
}

func promptCacheKey(tenantID, name string) string {
	return fmt.Sprintf("agent:prompts:%s:%s", tenantID, name)
}

func (s *promptService) GetVersionHistory(ctx context.Context, templateID string) ([]llmopsmodel.PromptVersion, error) {
	return s.repo.ListVersions(ctx, templateID)
}
