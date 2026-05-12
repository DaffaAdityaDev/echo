package database

import (
	"echo-backend/internal/models"
	"log"

	"github.com/redis/go-redis/v9"
)

// Infrastructure stores all database connections
type Infrastructure struct {
	Redis *redis.Client
	// DB    *gorm.DB // Placeholder for SQL database
}

func NewInfrastructure(cfg *models.Config) *Infrastructure {
	infra := &Infrastructure{}

	// Initialize Redis
	if cfg.RedisAddr != "" {
		infra.Redis = redis.NewClient(&redis.Options{
			Addr:     cfg.RedisAddr,
			Password: cfg.RedisPassword,
			DB:       0,
		})
		log.Println("Redis connection initialized")
	}

	return infra
}
