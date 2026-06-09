package config

import (
	cfgConst "echo-backend/internal/constants/config"
	"echo-backend/internal/models"
	"os"
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
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
