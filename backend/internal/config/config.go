package config

import (
	cfgConst "echo-backend/internal/constants/config"
	envconst "echo-backend/internal/constants/env"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/models/config"
	"fmt"
	"log/slog"
	"os"
	"strconv"
)

func Load() *cfgmodel.Config {
	c := &cfgmodel.Config{}
	c.Port = envStr(envconst.Port, cfgConst.DefaultPort)
	c.DatabaseURL = envStr(envconst.DatabaseURL, cfgConst.DefaultDatabaseURL)
	c.JWTSecret = envStr(envconst.JWTSecret, cfgConst.DefaultJWTSecret)
	c.Environment = envStr(envconst.Environment, cfgConst.DefaultEnvironment)
	c.AgentHTTPURL = envStr(envconst.HonoAPIURL, envStr(envconst.AgentHTTPURL, cfgConst.DefaultAgentHTTPURL))
	c.RedisAddr = envStr(envconst.RedisAddr, cfgConst.DefaultRedisAddr)
	c.RedisPassword = envStr(envconst.RedisPassword, cfgConst.DefaultRedisPass)
	c.InternalAuthToken = envStr(envconst.InternalAuthToken, cfgConst.DefaultInternalAuthToken)
	c.DefaultModel = envStr(envconst.DefaultModel, cfgConst.DefaultModel)
	c.ServiceJWTSecret = envStr(envconst.ServiceJWTSecret, cfgConst.DefaultServiceJWTSecret)
	c.DefaultUserTier = envStr(envconst.DefaultUserTier, cfgConst.DefaultUserTier)
	c.PRUNE_THRESHOLD = envInt(envconst.PruneThreshold, 100000)
	c.PRUNE_KEEP_LATEST_TURNS = envInt(envconst.PruneKeepLatestTurns, 10)
	c.SUMMARIZE_MAX_TOKENS = envInt(envconst.SummarizeMaxTokens, 500)
	c.HistoryMaxTokens = envInt(envconst.HistoryMaxTokens, 50000)
	c.HistoryMaxMsgChars = envInt(envconst.HistoryMaxMsgChars, 100000)
	c.ConsolidationSkipTokens = envInt(envconst.ConsolidationSkipTokens, 0)
	c.ConsolidationSkipRatio = envInt(envconst.ConsolidationSkipRatio, 90)
	c.SummarizePayloadRatio = envInt(envconst.SummarizePayloadRatio, 60)
	c.EncryptionKey = os.Getenv(envconst.EncryptionKey)
	if c.EncryptionKey == "" {
		slog.Warn(fmt.Sprintf(msgconst.WarnEncryptionKeyEmpty, envconst.EncryptionKey), msgconst.ComponentKey, msgconst.ComponentConfig, "hint", "Set a 32-char key.")
	}
	c.StrategyRolloutDefault = envFloat(envconst.StrategyRolloutDefault, 0.1)
	c.PromptTemplateName = envStr(envconst.PromptTemplateName, "")
	c.WorkerInterval = envStr(envconst.WorkerInterval, "15m")
	c.DecayDeprecateAfter = envInt(envconst.DecayDeprecateAfter, 30)
	c.DecayArchiveAfter = envInt(envconst.DecayArchiveAfter, 90)
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

func envFloat(key string, def float64) float64 {
	if v, ok := os.LookupEnv(key); ok {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return def
}
