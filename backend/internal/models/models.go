package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ProviderType string

const (
	ProviderOpenAI    ProviderType = "openai"
	ProviderAnthropic ProviderType = "anthropic"
	ProviderLMStudio  ProviderType = "lm-studio"
	ProviderOpenCode  ProviderType = "opencode-go"
)

type ProviderConfig struct {
	Type    ProviderType `json:"type"`
	BaseURL string       `json:"base_url"`
	APIKey  string       `json:"api_key,omitempty"`
	Model   string       `json:"model"`
}

type ModelInfo struct {
	ID           string       `json:"id"`
	Name         string       `json:"name,omitempty"`
	ProviderType ProviderType `json:"provider_type"`
	ProviderName string       `json:"provider_name"`
}

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
	InternalAuthToken string
	OpenAIAPIKey      string
	OpenAIBaseURL     string
	OpenAIModels      []string
	AnthropicAPIKey   string
	AnthropicBaseURL  string
	AnthropicModels   []string
	LMStudioBaseURL    string
	LMStudioAPIKey     string
	OpenCodeGoAPIKey   string
	DefaultModel       string
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
