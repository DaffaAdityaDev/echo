package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Config struct {
	Port          string
	DatabaseURL   string
	JWTSecret     string
	Environment   string
	AgentHTTPURL  string
	AllowOrigins  string
	RedisAddr     string
	RedisPassword string
	OtelCollectorAddr string
	EnableOtel        bool
}

type DB struct {
	Pool *pgxpool.Pool
}

func (db *DB) Close() {
	db.Pool.Close()
}

type User struct {
	ID           int       `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
