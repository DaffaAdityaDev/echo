package repository

import (
	"context"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/models"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ApiKeyRepository struct {
	pool *pgxpool.Pool
}

func NewApiKeyRepository(pool *pgxpool.Pool) *ApiKeyRepository {
	return &ApiKeyRepository{pool: pool}
}

func (r *ApiKeyRepository) Create(ctx context.Context, key *models.ApiKey) error {
	err := r.pool.QueryRow(ctx, db.QueryCreateApiKey, key.KeyHash, key.Prefix, key.Name, key.Scopes, key.UserID, key.Status).
		Scan(&key.ID, &key.CreatedAt)
	if err != nil {
		return fmt.Errorf("%s: %w", db.ErrCreateApiKey, err)
	}
	return nil
}

func (r *ApiKeyRepository) GetByHash(ctx context.Context, hash string) (*models.ApiKey, error) {
	var key models.ApiKey
	err := r.pool.QueryRow(ctx, db.QueryGetApiKeyByHash, hash).
		Scan(&key.ID, &key.KeyHash, &key.Prefix, &key.Name, &key.Scopes, &key.UserID, &key.Status, &key.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("%s: %w", db.ErrGetApiKey, err)
	}
	return &key, nil
}

func (r *ApiKeyRepository) GetByUserID(ctx context.Context, userID string) ([]models.ApiKey, error) {
	rows, err := r.pool.Query(ctx, db.QueryGetApiKeysByUser, userID)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", db.ErrListApiKeys, err)
	}
	defer rows.Close()

	var keys []models.ApiKey
	for rows.Next() {
		var key models.ApiKey
		if err := rows.Scan(&key.ID, &key.KeyHash, &key.Prefix, &key.Name, &key.Scopes, &key.UserID, &key.Status, &key.CreatedAt); err != nil {
			return nil, fmt.Errorf("%s: %w", db.ErrListApiKeys, err)
		}
		keys = append(keys, key)
	}
	return keys, rows.Err()
}

func (r *ApiKeyRepository) List(ctx context.Context) ([]models.ApiKey, error) {
	rows, err := r.pool.Query(ctx, db.QueryListApiKeys)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", db.ErrListApiKeys, err)
	}
	defer rows.Close()

	var keys []models.ApiKey
	for rows.Next() {
		var key models.ApiKey
		if err := rows.Scan(&key.ID, &key.KeyHash, &key.Prefix, &key.Name, &key.Scopes, &key.UserID, &key.Status, &key.CreatedAt); err != nil {
			return nil, fmt.Errorf("%s: %w", db.ErrListApiKeys, err)
		}
		keys = append(keys, key)
	}
	return keys, rows.Err()
}

func (r *ApiKeyRepository) Revoke(ctx context.Context, id string) error {
	result, err := r.pool.Exec(ctx, db.QueryRevokeApiKey, id)
	if err != nil {
		return fmt.Errorf("%s: %w", db.ErrRevokeApiKey, err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("%s: key not found or already revoked", db.ErrRevokeApiKey)
	}
	return nil
}

func (r *ApiKeyRepository) GetByID(ctx context.Context, id string) (*models.ApiKey, error) {
	var key models.ApiKey
	err := r.pool.QueryRow(ctx, db.QueryGetApiKeyByID, id).
		Scan(&key.ID, &key.KeyHash, &key.Prefix, &key.Name, &key.Scopes, &key.UserID, &key.Status, &key.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("%s: %w", db.ErrGetApiKey, err)
	}
	return &key, nil
}
