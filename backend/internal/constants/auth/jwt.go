package auth

const (
	HeaderAuthorization = "Authorization"
	BearerPrefix        = "Bearer "
	TokenCookie         = "auth_token"
)

const (
	ErrMissingToken = "Unauthorized: Missing token"
	ErrInvalidToken = "Unauthorized: Invalid token"
)
