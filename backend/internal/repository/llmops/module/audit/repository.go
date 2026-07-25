package audit

import (
	"context"
	"encoding/json"
	"fmt"

	"echo-backend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository interface {
	InsertAuditLog(ctx context.Context, log *models.AuditLog) error
	QueryAuditLogs(ctx context.Context, tenantID string, limit int) ([]models.AuditLog, error)
}

type repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{pool: pool}
}

func (r *repository) InsertAuditLog(ctx context.Context, log *models.AuditLog) error {
	payloadJSON, _ := json.Marshal(log.Payload)
	query := `
		INSERT INTO audit_logs (tenant_id, actor, action, resource, payload)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`
	err := r.pool.QueryRow(ctx, query, log.TenantID, log.Actor, log.Action, log.Resource, payloadJSON).
		Scan(&log.ID, &log.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert audit log: %w", err)
	}
	return nil
}

func (r *repository) QueryAuditLogs(ctx context.Context, tenantID string, limit int) ([]models.AuditLog, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `SELECT id, tenant_id, actor, action, resource, payload, created_at FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`
	rows, err := r.pool.Query(ctx, query, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("query audit logs: %w", err)
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		var payloadBytes []byte
		err := rows.Scan(&l.ID, &l.TenantID, &l.Actor, &l.Action, &l.Resource, &payloadBytes, &l.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan audit log: %w", err)
		}
		_ = json.Unmarshal(payloadBytes, &l.Payload)
		logs = append(logs, l)
	}
	return logs, nil
}
