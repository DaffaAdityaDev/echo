package database

import (
	"context"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/models/config"
	"log/slog"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func NewRedisClient(cfg *cfgmodel.Config) *redis.Client {
	if cfg.RedisAddr == "" {
		return nil
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:         cfg.RedisAddr,
		Password:     cfg.RedisPassword,
		DB:           0,
		PoolSize:     100,
		MinIdleConns: 10,
		PoolTimeout:  4 * time.Second,
	})
	slog.Info("redis connection initialized", "component", "database")
	return rdb
}

func NewPostgresPool(cfg *cfgmodel.Config) *pgxpool.Pool {
	if cfg.DatabaseURL == "" {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		slog.Error(db.ErrPostgresConfig, "err", err)
		os.Exit(1)
	}

	poolCfg.MaxConns = 10
	poolCfg.MinConns = 2

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		slog.Error(db.ErrPostgresPool, "err", err)
		os.Exit(1)
	}

	if err := pool.Ping(ctx); err != nil {
		slog.Error(db.ErrPostgresPing, "err", err)
		os.Exit(1)
	}

	slog.Info(db.MsgPostgresConnected, "component", "database")
	return pool
}
