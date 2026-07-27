package llmops

import (
	"context"
	"fmt"

	"echo-backend/internal/models"
	propsrepo "echo-backend/internal/repository/llmops/module/props"
)

type PromptService interface {
	CreatePromptTemplate(ctx context.Context, tenantID, name, desc string) (*models.PromptTemplate, error)
	ListTemplates(ctx context.Context, tenantID string) ([]models.PromptTemplate, error)
	CreateNewVersion(ctx context.Context, templateID, prompt, actor string, tools, vars []string) (*models.PromptVersion, error)
	GetVersion(ctx context.Context, templateID string, version int) (*models.PromptVersion, error)
	GetActivePrompt(ctx context.Context, tenantID, templateName string) (*models.PromptVersion, error)
	PromoteToProduction(ctx context.Context, templateID string, version int, actor string) error
	RollbackToVersion(ctx context.Context, templateID string, targetVersion int, actor string) error
	GetVersionHistory(ctx context.Context, templateID string) ([]models.PromptVersion, error)
}

type promptService struct {
	repo propsrepo.Repository
}

func NewPromptService(repo propsrepo.Repository) PromptService {
	return &promptService{repo: repo}
}

func (s *promptService) ListTemplates(ctx context.Context, tenantID string) ([]models.PromptTemplate, error) {
	return s.repo.ListTemplates(ctx, tenantID)
}

func (s *promptService) CreatePromptTemplate(ctx context.Context, tenantID, name, desc string) (*models.PromptTemplate, error) {
	if name == "" {
		return nil, fmt.Errorf("template name cannot be empty")
	}
	tmpl, err := s.repo.CreateTemplate(ctx, tenantID, name, desc)
	if err != nil {
		return nil, err
	}
	return tmpl, nil
}

func (s *promptService) CreateNewVersion(ctx context.Context, templateID, prompt, actor string, tools, vars []string) (*models.PromptVersion, error) {
	versions, err := s.repo.ListVersions(ctx, templateID)
	if err != nil {
		return nil, err
	}

	nextVersion := 1
	if len(versions) > 0 {
		nextVersion = versions[0].Version + 1
	}

	pv := &models.PromptVersion{
		TemplateID:   templateID,
		Version:      nextVersion,
		SystemPrompt: prompt,
		BoundTools:   tools,
		Variables:    vars,
		Status:       "draft",
		CreatedBy:    actor,
	}

	created, err := s.repo.CreateVersion(ctx, pv)
	if err != nil {
		return nil, err
	}

	return created, nil
}

func (s *promptService) GetVersion(ctx context.Context, templateID string, version int) (*models.PromptVersion, error) {
	v, err := s.repo.GetVersion(ctx, templateID, version)
	if err != nil || v == nil {
		return nil, fmt.Errorf("prompt version not found: %w", err)
	}
	return v, nil
}

func (s *promptService) GetActivePrompt(ctx context.Context, tenantID, templateName string) (*models.PromptVersion, error) {
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
	return nil
}

func (s *promptService) RollbackToVersion(ctx context.Context, templateID string, targetVersion int, actor string) error {
	err := s.repo.RollbackVersion(ctx, templateID, targetVersion, actor)
	if err != nil {
		return err
	}
	return nil
}

func (s *promptService) GetVersionHistory(ctx context.Context, templateID string) ([]models.PromptVersion, error) {
	return s.repo.ListVersions(ctx, templateID)
}
