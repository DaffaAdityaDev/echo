package cfgmodel

type Config struct {
	Port                    string
	DatabaseURL             string
	JWTSecret               string
	Environment             string
	AgentHTTPURL            string
	RedisAddr               string
	RedisPassword           string
	InternalAuthToken       string
	DefaultModel            string
	ServiceJWTSecret        string
	PRUNE_THRESHOLD         int
	PRUNE_KEEP_LATEST_TURNS int
	SUMMARIZE_MAX_TOKENS    int
	HistoryMaxTokens        int
	HistoryMaxMsgChars      int
	ConsolidationSkipTokens int
	EncryptionKey           string
	StrategyRolloutDefault  float64
	PromptTemplateName      string
	WorkerInterval          string
	DecayDeprecateAfter     int
	DecayArchiveAfter       int
}
