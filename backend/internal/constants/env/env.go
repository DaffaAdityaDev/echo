package env

const (
	Port                    = "PORT"
	DatabaseURL             = "DATABASE_URL"
	JWTSecret               = "JWT_SECRET"
	Environment             = "ENVIRONMENT"
	HonoAPIURL              = "HONO_API_URL"
	AgentHTTPURL            = "AGENT_HTTP_URL"
	RedisAddr               = "REDIS_ADDR"
	RedisPassword           = "REDIS_PASSWORD"
	InternalAuthToken       = "INTERNAL_AUTH_TOKEN"
	DefaultModel            = "DEFAULT_MODEL"
	ServiceJWTSecret        = "SERVICE_JWT_SECRET"
	DefaultUserTier         = "DEFAULT_USER_TIER"
	PruneThreshold          = "PRUNE_THRESHOLD"
	PruneKeepLatestTurns    = "PRUNE_KEEP_LATEST_TURNS"
	SummarizeMaxTokens      = "SUMMARIZE_MAX_TOKENS"
	HistoryMaxTokens        = "HISTORY_MAX_TOKENS"
	HistoryMaxMsgChars      = "HISTORY_MAX_MSG_CHARS"
	ConsolidationSkipTokens = "CONSOLIDATION_SKIP_TOKENS"
	ConsolidationSkipRatio  = "CONSOLIDATION_SKIP_RATIO"
	SummarizePayloadRatio   = "SUMMARIZE_PAYLOAD_RATIO"
	EncryptionKey           = "ENCRYPTION_KEY"
	StrategyRolloutDefault  = "STRATEGY_ROLLOUT_DEFAULT"
	PromptTemplateName      = "PROMPT_TEMPLATE_NAME"
	WorkerInterval          = "WORKER_INTERVAL"
	DecayDeprecateAfter     = "DECAY_DEPRECATE_AFTER"
	DecayArchiveAfter       = "DECAY_ARCHIVE_AFTER"
	LokiURL                 = "LOKI_URL"
	CORSAllowedOrigins      = "CORS_ALLOWED_ORIGINS"
	AdminPassword           = "ADMIN_PASSWORD"
	AppEnv                  = "APP_ENV"
)

const (
	DefaultCORSOrigins = "http://localhost:3000,http://127.0.0.1:3000"
	DefaultCORSOrigin  = "http://localhost:3000"
)
