package models

import (
	"time"
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
	ServiceJWTSecret   string
	PRUNE_THRESHOLD         int
	PRUNE_KEEP_LATEST_TURNS int
	SUMMARIZE_MAX_TOKENS    int
}

type ApiKey struct {
	ID        string     `json:"id"`
	KeyHash   string     `json:"-"`
	Prefix    string     `json:"prefix"`
	Name      string     `json:"name"`
	Scopes    []string   `json:"scopes"`
	UserID    string     `json:"user_id"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
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

type Session struct {
	ID             string    `json:"id"`
	UserID         int       `json:"user_id"`
	Title          string    `json:"title"`
	ContextSummary string    `json:"context_summary"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	MessageCount   int       `json:"message_count,omitempty"`
	TokenCount     int       `json:"token_count,omitempty"`
}

type UserPreferences struct {
	UserID         int      `json:"user_id"`
	DefaultMode    string   `json:"default_mode"`
	DefaultModel   string   `json:"default_model"`
	DefaultFeatures []string `json:"default_features"`
	DefaultSkills  []string `json:"default_skills"`
}

type Message struct {
	ID         int64     `json:"id"`
	SessionID  string    `json:"session_id"`
	Role       string    `json:"role"`
	Content    string    `json:"content"`
	TokenCount int       `json:"token_count"`
	TurnNumber int       `json:"turn_number"`
	CreatedAt  time.Time `json:"created_at"`
}
