package config

import (
	cfgConst "echo-backend/internal/constants/config"
	"echo-backend/internal/models"
	"os"
	"strings"
)

func Load() *models.Config {
	return &models.Config{
		Port:          getEnv("PORT", cfgConst.DefaultPort),
		DatabaseURL:   getEnv("DATABASE_URL", cfgConst.DefaultDatabaseURL),
		JWTSecret:     getEnv("JWT_SECRET", cfgConst.DefaultJWTSecret),
		Environment:   getEnv("ENVIRONMENT", cfgConst.DefaultEnvironment),
		AgentHTTPURL:  getEnv("HONO_API_URL", getEnv("AGENT_HTTP_URL", cfgConst.DefaultAgentHTTPURL)),
		AllowOrigins:  getEnv("ALLOW_ORIGINS", cfgConst.DefaultAllowOrigins),
		RedisAddr:     getEnv("REDIS_ADDR", cfgConst.DefaultRedisAddr),
		RedisPassword: getEnv("REDIS_PASSWORD", cfgConst.DefaultRedisPass),
		OtelCollectorAddr: getEnv("OTEL_COLLECTOR_ADDR", "otel-collector:4317"),
		EnableOtel:        getEnv("ENABLE_OTEL", "false") == "true",
		InternalAuthToken: getEnv("INTERNAL_AUTH_TOKEN", "default-internal-token-secret"),
		OpenAIAPIKey:      os.Getenv("OPENAI_API_KEY"),
		OpenAIBaseURL:     getEnv("OPENAI_BASE_URL", cfgConst.DefaultOpenAIBaseURL),
		OpenAIModels:      splitEnv(getEnv("OPENAI_MODELS", "gpt-4o,gpt-4o-mini")),
		AnthropicAPIKey:   os.Getenv("ANTHROPIC_API_KEY"),
		AnthropicBaseURL:  getEnv("ANTHROPIC_BASE_URL", cfgConst.DefaultAnthropicBaseURL),
		AnthropicModels:   splitEnv(getEnv("ANTHROPIC_MODELS", "claude-3-5-sonnet-latest,claude-3-haiku")),
		LMStudioBaseURL:   os.Getenv("LM_STUDIO_BASE_URL"),
		LMStudioAPIKey:    os.Getenv("LM_STUDIO_API_KEY"),
		OpenCodeGoAPIKey:  os.Getenv("OPENCODE_GO_API_KEY"),
		DefaultModel:      getEnv("DEFAULT_MODEL", cfgConst.DefaultModel),
	}
}

func splitEnv(val string) []string {
	parts := strings.Split(val, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
