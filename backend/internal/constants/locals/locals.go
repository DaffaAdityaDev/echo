package locals

// Fiber request-context keys shared across middleware, handlers, and the
// handlerutil helpers. The middleware packages set these; handlers read them
// via the accessor helpers or directly. Centralized so the key strings never
// drift between writer and reader.
const (
	UserID    = "user_id"
	UserRole  = "user_role"
	UserTier  = "user_tier"
	UserEmail = "user_email"

	APIKeyID     = "api_key_id"
	APIKeyName   = "api_key_name"
	APIKeyScopes = "api_key_scopes"
	APIKeyUserID = "api_key_user_id"

	ServiceName = "service_name"
)
