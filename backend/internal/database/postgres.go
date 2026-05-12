package database

import (
	"context"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/models"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(connString string) (*models.DB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", db.ErrPostgresConfig, err)
	}

	config.MaxConns = 10
	config.MinConns = 2

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", db.ErrPostgresPool, err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("%s: %w", db.ErrPostgresPing, err)
	}

	log.Println(db.MsgPostgresConnected)
	return &models.DB{Pool: pool}, nil
}
