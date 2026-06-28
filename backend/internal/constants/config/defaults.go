package config

const (
	DefaultPort         = "8080"
	DefaultDatabaseURL  = "postgresql://localhost/echo_db?sslmode=disable"
	DefaultJWTSecret    = "your-secret-key"
	DefaultEnvironment  = "development"
	DefaultAgentHTTPURL = "http://localhost:3001"
	DefaultAllowOrigins = "http://localhost:3000"
)

const (
	DefaultRedisAddr = "localhost:6379"
	DefaultRedisPass = ""
)

const (
	DefaultOpenAIBaseURL    = "https://api.openai.com/v1"
	DefaultAnthropicBaseURL = "https://api.anthropic.com"
	DefaultLMStudioBaseURL  = "http://localhost:1234"
	DefaultModel            = "gpt-4o"
)
