package config

const (
	DefaultPort         = "8080"
	DefaultDatabaseURL  = "postgresql://localhost/echo_db?sslmode=disable"
	DefaultJWTSecret    = "your-secret-key"
	DefaultEnvironment  = "development"
	DefaultAgentHTTPURL = "http://localhost:3001"
)

const (
	DefaultRedisAddr = "localhost:6379"
	DefaultRedisPass = ""
)

const (
	DefaultModel            = "opencode-go/deepseek-v4-flash"
	DefaultServiceJWTSecret = "default-service-jwt-secret"
	// DefaultInternalAuthToken is the dev-only fallback for INTERNAL_AUTH_TOKEN.
	// Production startup refuses to run with any default secret (see config.ValidateSecrets).
	DefaultInternalAuthToken = "default-internal-token-secret"
	// DefaultUserTier is the least-privilege tier assigned to newly registered users.
	DefaultUserTier = "free"
)
