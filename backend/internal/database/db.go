package database

import (
	"context"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/models"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func NewRedisClient(cfg *models.Config) *redis.Client {
	if cfg.RedisAddr == "" {
		return nil
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       0,
	})
	log.Println("Redis connection initialized")
	return rdb
}

func NewPostgresPool(cfg *models.Config) *pgxpool.Pool {
	if cfg.DatabaseURL == "" {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("%s: %v", db.ErrPostgresConfig, err)
	}

	poolCfg.MaxConns = 10
	poolCfg.MinConns = 2

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		log.Fatalf("%s: %v", db.ErrPostgresPool, err)
	}

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("%s: %v", db.ErrPostgresPing, err)
	}

	log.Println(db.MsgPostgresConnected)
	return pool
}
