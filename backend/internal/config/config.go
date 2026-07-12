package config

import (
	cfgConst "echo-backend/internal/constants/config"
	"echo-backend/internal/models"
	"os"
	"strconv"
	"strings"
)

func Load() *models.Config {
	c := &models.Config{}
	c.Port = envStr("PORT", cfgConst.DefaultPort)
	c.DatabaseURL = envStr("DATABASE_URL", cfgConst.DefaultDatabaseURL)
	c.JWTSecret = envStr("JWT_SECRET", cfgConst.DefaultJWTSecret)
	c.Environment = envStr("ENVIRONMENT", cfgConst.DefaultEnvironment)
	c.AgentHTTPURL = envStr("HONO_API_URL", envStr("AGENT_HTTP_URL", cfgConst.DefaultAgentHTTPURL))
	c.AllowOrigins = envStr("ALLOW_ORIGINS", cfgConst.DefaultAllowOrigins)
	c.RedisAddr = envStr("REDIS_ADDR", cfgConst.DefaultRedisAddr)
	c.RedisPassword = envStr("REDIS_PASSWORD", cfgConst.DefaultRedisPass)
	c.OtelCollectorAddr = envStr("OTEL_COLLECTOR_ADDR", "otel-collector:4317")
	c.EnableOtel = envStr("ENABLE_OTEL", "false") == "true"
	c.InternalAuthToken = envStr("INTERNAL_AUTH_TOKEN", "default-internal-token-secret")
	c.OpenAIAPIKey = os.Getenv("OPENAI_API_KEY")
	c.OpenAIBaseURL = envStr("OPENAI_BASE_URL", cfgConst.DefaultOpenAIBaseURL)
	c.OpenAIModels = splitEnv(envStr("OPENAI_MODELS", "gpt-4o,gpt-4o-mini"))
	c.AnthropicAPIKey = os.Getenv("ANTHROPIC_API_KEY")
	c.AnthropicBaseURL = envStr("ANTHROPIC_BASE_URL", cfgConst.DefaultAnthropicBaseURL)
	c.AnthropicModels = splitEnv(envStr("ANTHROPIC_MODELS", "claude-3-5-sonnet-latest,claude-3-haiku"))
	c.LMStudioBaseURL = os.Getenv("LM_STUDIO_BASE_URL")
	c.LMStudioAPIKey = os.Getenv("LM_STUDIO_API_KEY")
	c.OpenCodeGoAPIKey = os.Getenv("OPENCODE_GO_API_KEY")
	c.DefaultModel = envStr("DEFAULT_MODEL", cfgConst.DefaultModel)
	c.ServiceJWTSecret = envStr("SERVICE_JWT_SECRET", cfgConst.DefaultServiceJWTSecret)
	c.PRUNE_THRESHOLD = envInt("PRUNE_THRESHOLD", 100000)
	c.PRUNE_KEEP_LATEST_TURNS = envInt("PRUNE_KEEP_LATEST_TURNS", 10)
	c.SUMMARIZE_MAX_TOKENS = envInt("SUMMARIZE_MAX_TOKENS", 500)
	return c
}

func envStr(key, def string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v, ok := os.LookupEnv(key); ok {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
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
