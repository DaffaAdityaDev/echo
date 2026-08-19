package db

// User queries (owner: repository/auth)
const (
	QueryCreateUser = `
		INSERT INTO users (email, password_hash, name, role, tier, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	QueryGetUserByEmail = `
		SELECT id, email, password_hash, name, role, tier, created_at, updated_at
		FROM users
		WHERE email = $1
	`
)

const (
	QueryGetUserByID = `
		SELECT id, email, password_hash, name, role, tier, created_at, updated_at
		FROM users
		WHERE id = $1
	`
)

const (
	QueryCreateRefreshToken = `
		INSERT INTO refresh_tokens (user_id, token_hash, device_label, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`
	QueryFindRefreshTokenByHash = `
		SELECT id, user_id, token_hash, device_label, expires_at, revoked_at,
		created_at FROM refresh_tokens
		WHERE token_hash = $1
	`
	QueryRevokeRefreshToken = `
		UPDATE refresh_tokens SET revoked_at = NOW()
		WHERE id = $1 AND revoked_at IS NULL
	`
	QueryRevokeRefreshTokensByUser = `
		UPDATE refresh_tokens SET revoked_at = NOW()
		WHERE user_id = $1 AND revoked_at IS NULL
	`
)

const (
	ErrCreateRefreshToken      = "failed to create refresh token"
	ErrFindRefreshToken        = "failed to find refresh token"
	ErrRevokeRefreshToken      = "failed to revoke refresh token"
	ErrRevokeRefreshTokensUser = "failed to revoke refresh tokens by user"
)

const (
	ErrCreateUser = "failed to create user"
	ErrGetUser    = "failed to get user by id"
)
