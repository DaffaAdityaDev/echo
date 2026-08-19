package auth

const (
	HeaderAuthorization = "Authorization"
	BearerPrefix        = "Bearer "
	TokenCookie         = "auth_token"
	RefreshCookie       = "refresh_token"
)

// JWT claim names used by the user token (signed with JWTSecret) and the
// internal service token (signed with ServiceJWTSecret). golang-jwt does not
// export claim-name constants, so they are centralized here to keep the
// writer (token generation) and readers (middleware) in sync.
const (
	ClaimSubject = "sub"
	ClaimRole    = "role"
	ClaimEmail   = "email"
	ClaimExp     = "exp"
	ClaimIat     = "iat"
)
