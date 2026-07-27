package settings

import (
	"context"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/models"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func nonil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func (r *Repository) Get(ctx context.Context, userID int) (*models.UserPreferences, error) {
	var p models.UserPreferences
	var features, skills []string
	var updatedAt time.Time

	err := r.pool.QueryRow(ctx, db.QueryGetPreferences, userID).
		Scan(&p.UserID, &p.DefaultMode, &p.DefaultModel, &features, &skills, &p.ProviderType, &p.APIKey, &p.BaseURL, &updatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get preferences: %w", err)
	}

	p.DefaultFeatures = nonil(features)
	p.DefaultSkills = nonil(skills)

	return &p, nil
}

func (r *Repository) Upsert(ctx context.Context, userID int, prefs *models.UserPreferences) (*models.UserPreferences, error) {
	var p models.UserPreferences
	var features, skills []string
	var updatedAt pgtype.Timestamptz

	if prefs.DefaultFeatures == nil {
		prefs.DefaultFeatures = []string{}
	}
	if prefs.DefaultSkills == nil {
		prefs.DefaultSkills = []string{}
	}

	err := r.pool.QueryRow(ctx, db.QueryUpsertPreferences,
		userID, prefs.DefaultMode, prefs.DefaultModel, prefs.DefaultFeatures, prefs.DefaultSkills,
		prefs.ProviderType, prefs.APIKey, prefs.BaseURL).
		Scan(&p.UserID, &p.DefaultMode, &p.DefaultModel, &features, &skills, &p.ProviderType, &p.APIKey, &p.BaseURL, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert preferences: %w", err)
	}

	p.DefaultFeatures = nonil(features)
	p.DefaultSkills = nonil(skills)

	return &p, nil
}
