package llmops

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/models/llmops"
	propsrepo "echo-backend/internal/repository/llmops/module/props"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/redis/go-redis/v9"
)

type PromptService interface {
	CreatePromptTemplate(ctx context.Context, tenantID, name, desc string) (*llmopsmodel.PromptTemplate, error)
	ListTemplates(ctx context.Context, tenantID string) ([]llmopsmodel.PromptTemplate, error)
	CreateNewVersion(ctx context.Context, tenantID, templateID, prompt, actor string, tools, vars []string) (*llmopsmodel.PromptVersion, error)
	GetVersion(ctx context.Context, tenantID, templateID string, version int) (*llmopsmodel.PromptVersion, error)
	GetActivePrompt(ctx context.Context, tenantID, templateName string) (*llmopsmodel.PromptVersion, error)
	PromoteToProduction(ctx context.Context, tenantID, templateID string, version int, actor string) error
	RollbackToVersion(ctx context.Context, tenantID, templateID string, targetVersion int, actor string) error
	GetVersionHistory(ctx context.Context, tenantID, templateID string) ([]llmopsmodel.PromptVersion, error)
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
	if strings.TrimSpace(name) == "" {
		return nil, llmopsmodel.ErrTemplateNameRequired
	}
	tmpl, err := s.repo.CreateTemplate(ctx, tenantID, name, desc)
	if isUniqueViolation(err) {
		return nil, llmopsmodel.ErrTemplateNameTaken
	}
	if err != nil {
		return nil, err
	}
	return tmpl, nil
}

func (s *promptService) CreateNewVersion(ctx context.Context, tenantID, templateID, prompt, actor string, tools, vars []string) (*llmopsmodel.PromptVersion, error) {
	if _, err := s.authorizeTemplate(ctx, tenantID, templateID); err != nil {
		return nil, err
	}

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

		if !isUniqueViolation(err) {
			return nil, fmt.Errorf("create version: %w", err)
		}
		if attempt == maxAttempts {
			return nil, fmt.Errorf("create version: version conflict persists after %d attempts", maxAttempts)
		}
	}
}

func (s *promptService) GetVersion(ctx context.Context, tenantID, templateID string, version int) (*llmopsmodel.PromptVersion, error) {
	if _, err := s.authorizeTemplate(ctx, tenantID, templateID); err != nil {
		return nil, err
	}
	v, err := s.repo.GetVersion(ctx, templateID, version)
	if err != nil {
		return nil, fmt.Errorf("get prompt version: %w", err)
	}
	if v == nil {
		return nil, llmopsmodel.ErrVersionNotFound
	}
	return v, nil
}

func (s *promptService) GetActivePrompt(ctx context.Context, tenantID, templateName string) (*llmopsmodel.PromptVersion, error) {
	v, err := s.repo.GetActiveVersionByName(ctx, tenantID, templateName)
	if err != nil {
		return nil, fmt.Errorf("get active prompt version: %w", err)
	}
	if v == nil {
		return nil, llmopsmodel.ErrVersionNotFound
	}
	return v, nil
}

func (s *promptService) PromoteToProduction(ctx context.Context, tenantID, templateID string, version int, actor string) error {
	tmpl, err := s.authorizeTemplate(ctx, tenantID, templateID)
	if err != nil {
		return err
	}
	if err := s.repo.PromoteVersion(ctx, templateID, version, actor); err != nil {
		return err
	}
	s.invalidateActivePromptCache(ctx, tmpl)
	return nil
}

func (s *promptService) RollbackToVersion(ctx context.Context, tenantID, templateID string, targetVersion int, actor string) error {
	tmpl, err := s.authorizeTemplate(ctx, tenantID, templateID)
	if err != nil {
		return err
	}
	if err := s.repo.RollbackVersion(ctx, templateID, targetVersion, actor); err != nil {
		return err
	}
	s.invalidateActivePromptCache(ctx, tmpl)
	return nil
}

func (s *promptService) GetVersionHistory(ctx context.Context, tenantID, templateID string) ([]llmopsmodel.PromptVersion, error) {
	if _, err := s.authorizeTemplate(ctx, tenantID, templateID); err != nil {
		return nil, err
	}
	return s.repo.ListVersions(ctx, templateID)
}

// authorizeTemplate loads the template and confirms tenantID owns it. A
// template owned by another tenant is reported as not found so its existence
// is not disclosed.
func (s *promptService) authorizeTemplate(ctx context.Context, tenantID, templateID string) (*llmopsmodel.PromptTemplate, error) {
	tmpl, err := s.repo.GetTemplateByID(ctx, templateID)
	if err != nil {
		return nil, fmt.Errorf("get template: %w", err)
	}
	if tmpl == nil || tmpl.TenantID != tenantID {
		return nil, llmopsmodel.ErrTemplateNotFound
	}
	return tmpl, nil
}

func (s *promptService) invalidateActivePromptCache(ctx context.Context, tmpl *llmopsmodel.PromptTemplate) {
	if s.rdb == nil {
		return
	}
	key := promptCacheKey(tmpl.TenantID, tmpl.Name)
	if err := s.rdb.Del(ctx, key).Err(); err != nil {
		slog.Error(msgconst.ErrLLMOpsInvalidateCache, msgconst.ComponentKey, msgconst.ComponentLLMOps, msgconst.KeyKey, key, msgconst.KeyErr, err)
	}
}

func promptCacheKey(tenantID, name string) string {
	return fmt.Sprintf("agent:prompts:%s:%s", tenantID, name)
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
