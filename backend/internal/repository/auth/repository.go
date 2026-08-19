package auth

import (
	"context"
	"echo-backend/internal/constants/db"
	authmodel "echo-backend/internal/models/auth"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) Create(ctx context.Context, user *authmodel.User) error {
	err := r.pool.QueryRow(ctx, db.QueryCreateUser, user.Email, user.PasswordHash, user.Name, user.Role, user.Tier).
		Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return fmt.Errorf("%s: %w", db.ErrCreateUser, err)
	}
	return nil
}

func (r *Repository) GetByEmail(ctx context.Context, email string) (*authmodel.User, error) {
	var user authmodel.User
	err := r.pool.QueryRow(ctx, db.QueryGetUserByEmail, email).
		Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Role, &user.Tier, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("%s: %w", db.ErrGetUser, err)
	}
	return &user, nil
}

func (r *Repository) GetUserByID(ctx context.Context, id int) (*authmodel.User, error) {
	var user authmodel.User
	err := r.pool.QueryRow(ctx, db.QueryGetUserByID, id).
		Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Role, &user.Tier, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("%s: %w", db.ErrGetUser, err)
	}
	return &user, nil
}

func (r *Repository) CreateRefreshToken(ctx context.Context, userID int, tokenHash, deviceLabel string, expiresAt time.Time) (int64, error) {
	var id int64
	err := r.pool.QueryRow(ctx, db.QueryCreateRefreshToken, userID, tokenHash, deviceLabel, expiresAt).
		Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("%s: %w", db.ErrCreateRefreshToken, err)
	}
	return id, nil
}

func (r *Repository) FindRefreshTokenByHash(ctx context.Context, tokenHash string) (*authmodel.RefreshToken, error) {
	var rt authmodel.RefreshToken
	err := r.pool.QueryRow(ctx, db.QueryFindRefreshTokenByHash, tokenHash).
		Scan(&rt.ID, &rt.UserID, &rt.TokenHash, &rt.DeviceLabel, &rt.ExpiresAt, &rt.RevokedAt, &rt.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("%s: %w", db.ErrFindRefreshToken, err)
	}
	return &rt, nil
}

func (r *Repository) RevokeRefreshToken(ctx context.Context, id int64) error {
	if _, err := r.pool.Exec(ctx, db.QueryRevokeRefreshToken, id); err != nil {
		return fmt.Errorf("%s: %w", db.ErrRevokeRefreshToken, err)
	}
	return nil
}

func (r *Repository) RevokeRefreshTokensByUser(ctx context.Context, userID int) error {
	if _, err := r.pool.Exec(ctx, db.QueryRevokeRefreshTokensByUser, userID); err != nil {
		return fmt.Errorf("%s: %w", db.ErrRevokeRefreshTokensUser, err)
	}
	return nil
}
