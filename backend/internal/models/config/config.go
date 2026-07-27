package cfgmodel

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
	DefaultModel       string
	ServiceJWTSecret   string
	PRUNE_THRESHOLD         int
	PRUNE_KEEP_LATEST_TURNS int
	SUMMARIZE_MAX_TOKENS    int
	EvaluatorEndpoint string
	EvaluatorAPIKey   string
	EvaluatorModel    string
	EncryptionKey     string
}
