package llmops

import (
	"context"

	"echo-backend/internal/models"
	"echo-backend/internal/repository/llmops"
)

type AuditService interface {
	Record(ctx context.Context, tenantID, actor, action, resource string, payload map[string]any) error
	QueryLogs(ctx context.Context, tenantID string, limit int) ([]models.AuditLog, error)
}

type auditService struct {
	repo llmops.AuditRepository
}

func NewAuditService(repo llmops.AuditRepository) AuditService {
	return &auditService{repo: repo}
}

func (s *auditService) Record(ctx context.Context, tenantID, actor, action, resource string, payload map[string]any) error {
	log := &models.AuditLog{
		TenantID: tenantID,
		Actor:    actor,
		Action:   action,
		Resource: resource,
		Payload:  payload,
	}
	return s.repo.InsertAuditLog(ctx, log)
}

func (s *auditService) QueryLogs(ctx context.Context, tenantID string, limit int) ([]models.AuditLog, error) {
	return s.repo.QueryAuditLogs(ctx, tenantID, limit)
}
