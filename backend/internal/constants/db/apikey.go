package db

// API key queries (owner: repository/admin)
const (
	QueryCreateApiKey    = `INSERT INTO api_keys (key_hash, prefix, name, scopes, user_id, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`
	QueryGetApiKeyByHash = `SELECT id, key_hash, prefix, name, scopes, user_id, status, created_at FROM api_keys WHERE key_hash = $1`
	QueryListApiKeys     = `SELECT id, key_hash, prefix, name, scopes, user_id, status, created_at FROM api_keys ORDER BY created_at DESC`
	QueryRevokeApiKey    = `UPDATE api_keys SET status = 'revoked' WHERE id = $1 AND status = 'active'`
	QueryGetApiKeyByID   = `SELECT id, key_hash, prefix, name, scopes, user_id, status, created_at FROM api_keys WHERE id = $1`
)

// API key error messages
const (
	ErrCreateApiKey         = "failed to create API key"
	ErrGetApiKey            = "failed to get API key"
	ErrListApiKeys          = "failed to list API keys"
	ErrRevokeApiKey         = "failed to revoke API key"
	ErrRevokeApiKeyNotFound = "key not found or already revoked"
)
