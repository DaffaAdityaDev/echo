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
	// ConsolidationSkipRatio is the percentage of the model context window at
	// which consolidation is skipped (sessions beyond it cannot be
	// summarized). Used when ConsolidationSkipTokens is not set.
	ConsolidationSkipRatio int
	// SummarizePayloadRatio is the percentage of the model context window
	// used as the summarize payload budget. Used when HistoryMaxTokens is not
	// set.
	SummarizePayloadRatio  int
	EncryptionKey          string
	StrategyRolloutDefault float64
	PromptTemplateName     string
	DefaultUserTier        string
	WorkerInterval         string
	DecayDeprecateAfter    int
	DecayArchiveAfter      int
}
