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

// Placeholder values committed in .env.example. Production startup refuses
// them (see config.ValidateSecrets); other environments only warn.
const (
	PlaceholderJWTSecret         = "replace-this-with-a-secure-secret"
	PlaceholderServiceJWTSecret  = "change-this-to-a-secure-service-jwt-secret-min32chars"
	PlaceholderInternalAuthToken = "change-me-internal-token"
	PlaceholderEncryptionKey     = "change-this-to-a-32-char-key!!!!"
)

const (
	// MinSecretLength is the minimum length accepted in production for
	// secrets that sign or authenticate tokens.
	MinSecretLength = 32
	// EncryptionKeyLength is the exact ENCRYPTION_KEY length AES-256 requires.
	EncryptionKeyLength = 32
)
