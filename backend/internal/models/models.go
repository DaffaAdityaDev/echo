package models

import (
	"encoding/json"
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
	Type    ProviderType `json:"type" example:"openai"`
	BaseURL string       `json:"base_url" example:"https://api.openai.com/v1"`
	APIKey  string       `json:"api_key,omitempty" example:"sk-xxxxxxxxxxxxxxxx"`
	Model   string       `json:"model" example:"gpt-4o"`
}

type ModelInfo struct {
	ID           string       `json:"id" example:"gpt-4o"`
	Name         string       `json:"name,omitempty" example:"GPT-4o"`
	ProviderType ProviderType `json:"provider_type" example:"openai"`
	ProviderName string       `json:"provider_name" example:"OpenAI"`
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
	ID        string     `json:"id" example:"key_a1b2c3d4e5f6"`
	KeyHash   string     `json:"-"`
	Prefix    string     `json:"prefix" example:"sk_a1b2c3d4"`
	Name      string     `json:"name" example:"Production API Key"`
	Scopes    []string   `json:"scopes" example:"read,write,admin"`
	UserID    string     `json:"user_id" example:"1"`
	Status    string     `json:"status" example:"active"`
	CreatedAt time.Time  `json:"created_at" example:"2026-01-15T10:30:00Z"`
}

type User struct {
	ID           int       `json:"id" example:"1"`
	Email        string    `json:"email" example:"jane@example.com"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name" example:"Jane Doe"`
	Role         string    `json:"role" example:"user"`
	CreatedAt    time.Time `json:"created_at" example:"2026-01-15T10:30:00Z"`
	UpdatedAt    time.Time `json:"updated_at" example:"2026-01-15T10:30:00Z"`
}

type Session struct {
	ID             string    `json:"id" example:"sess_abc123"`
	UserID         int       `json:"user_id" example:"1"`
	Title          string    `json:"title" example:"Build a REST API with Express"`
	ContextSummary string    `json:"context_summary" example:"User is building a REST API for a todo app using Express and Prisma"`
	Status         string    `json:"status" example:"active"`
	CreatedAt      time.Time `json:"created_at" example:"2026-01-15T10:30:00Z"`
	UpdatedAt      time.Time `json:"updated_at" example:"2026-01-15T11:45:00Z"`
	MessageCount   int       `json:"message_count,omitempty" example:"12"`
	TokenCount     int       `json:"token_count,omitempty" example:"3421"`
}

type UserPreferences struct {
	UserID         int      `json:"user_id" example:"1"`
	DefaultMode    string   `json:"default_mode" example:"agent"`
	DefaultModel   string   `json:"default_model" example:"gpt-4o"`
	DefaultFeatures []string `json:"default_features" example:"web-browsing,code-interpreter"`
	DefaultSkills  []string `json:"default_skills" example:"python,research"`
}

type ThoughtStep struct {
	Type      string          `json:"type"`
	Content   string          `json:"content,omitempty"`
	ToolName  string          `json:"toolName,omitempty"`
	ToolInput json.RawMessage `json:"toolInput,omitempty"`
}

type Message struct {
	ID         int64           `json:"id" example:"42"`
	SessionID  string          `json:"session_id" example:"sess_abc123"`
	Role       string          `json:"role" example:"assistant"`
	Content    string          `json:"content" example:"Echo is an AI agent platform that can autonomously execute complex tasks by reasoning, using tools, and learning from feedback."`
	TokenCount int             `json:"token_count" example:"156"`
	TurnNumber int             `json:"turn_number" example:"3"`
	Steps      json.RawMessage `json:"steps,omitempty"`
	CreatedAt  time.Time       `json:"created_at" example:"2026-01-15T10:35:00Z"`
}
