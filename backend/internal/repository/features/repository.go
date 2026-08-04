package features

import (
	"context"
	"echo-backend/internal/constants/db"
	featuresmodel "echo-backend/internal/models/features"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) ListActive(ctx context.Context) ([]featuresmodel.Feature, error) {
	rows, err := r.pool.Query(ctx, db.QueryListActiveFeatures)
	if err != nil {
		return nil, fmt.Errorf("failed to list active features: %w", err)
	}
	defer rows.Close()

	var features []featuresmodel.Feature
	for rows.Next() {
		var f featuresmodel.Feature
		if err := rows.Scan(&f.ID, &f.Name, &f.Description, &f.TierRequirement, &f.UISchema, &f.Status, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan feature row: %w", err)
		}
		features = append(features, f)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate feature rows: %w", err)
	}
	return features, nil
}

func (r *Repository) GetByID(ctx context.Context, id string) (*featuresmodel.Feature, error) {
	var f featuresmodel.Feature
	err := r.pool.QueryRow(ctx, db.QueryGetFeatureByID, id).
		Scan(&f.ID, &f.Name, &f.Description, &f.TierRequirement, &f.UISchema, &f.Status, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get feature %s: %w", id, err)
	}
	return &f, nil
}
