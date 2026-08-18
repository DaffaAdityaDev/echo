package auth

import (
	"context"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/models/auth"
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
