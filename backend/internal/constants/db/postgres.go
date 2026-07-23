package db

const (
	MsgPostgresConnected = "Connected to PostgreSQL successfully"
	ErrPostgresConfig    = "unable to parse database config"
	ErrPostgresPool      = "unable to create connection pool"
	ErrPostgresPing      = "unable to ping database"
)

const (
	QueryCreateUser = `
		INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	QueryGetUserByEmail = `
		SELECT id, email, password_hash, name, role, created_at, updated_at
		FROM users
		WHERE email = $1
	`
)

const (
	QueryGetUserByID = `
		SELECT id, email, password_hash, name, role, created_at, updated_at
		FROM users
		WHERE id = $1
	`
)

const (
	QueryCreateSession = `
		INSERT INTO sessions (user_id, title, context_summary, status, created_at, updated_at)
		VALUES ($1, $2, '', 'active', NOW(), NOW())
		RETURNING id, user_id, title, context_summary, status, created_at, updated_at
	`
	QueryListSessions = `
		SELECT s.id, s.user_id, s.title, s.context_summary, s.status, s.created_at, s.updated_at,
		       COUNT(m.id) as message_count,
		       COALESCE(SUM(m.token_count), 0) as token_count
		FROM sessions s
		LEFT JOIN messages m ON m.session_id = s.id
		WHERE s.user_id = $1 AND s.status = 'active'
		GROUP BY s.id, s.user_id, s.title, s.context_summary, s.status, s.created_at, s.updated_at
		ORDER BY s.updated_at DESC
	`
	QueryGetSession = `
		SELECT s.id, s.user_id, s.title, s.context_summary, s.status, s.created_at, s.updated_at,
		       COUNT(m.id) as message_count,
		       COALESCE(SUM(m.token_count), 0) as token_count
		FROM sessions s
		LEFT JOIN messages m ON m.session_id = s.id
		WHERE s.id = $1
		GROUP BY s.id, s.user_id, s.title, s.context_summary, s.status, s.created_at, s.updated_at
	`
	QueryDeleteSession = `
		UPDATE sessions
		SET status = 'deleted', updated_at = NOW()
		WHERE id = $1
	`
	QueryUpdateContextSummary = `
		UPDATE sessions
		SET context_summary = $2, updated_at = NOW()
		WHERE id = $1
	`
	QueryUpdateSessionTitleAndSummary = `
		UPDATE sessions
		SET title = $2, context_summary = $3, updated_at = NOW()
		WHERE id = $1
	`
	QueryGetSessionMessages = `
		SELECT id, session_id, role, content, token_count, turn_number, COALESCE(steps, 'null') as steps, created_at
		FROM messages
		WHERE session_id = $1
		ORDER BY turn_number ASC, id ASC
	`
	QueryGetSessionTokenCount = `
		SELECT COALESCE(SUM(token_count), 0)
		FROM messages
		WHERE session_id = $1
	`
	QueryGetMaxTurnNumber = `
		SELECT COALESCE(MAX(turn_number), 0)
		FROM messages
		WHERE session_id = $1
	`
	QueryDeleteMessagesUpToTurn = `
		DELETE FROM messages
		WHERE session_id = $1 AND turn_number <= $2
	`
	QueryInsertMessage = `
		INSERT INTO messages (session_id, role, content, token_count, turn_number, steps, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
	`
	QueryUpdateSessionUpdatedAt = `
		UPDATE sessions
		SET updated_at = NOW()
		WHERE id = $1
	`
)

const (
	QueryUpsertPreferences = `
		INSERT INTO user_preferences (user_id, default_mode, default_model, default_features, default_skills, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (user_id)
		DO UPDATE SET
			default_mode = EXCLUDED.default_mode,
			default_model = EXCLUDED.default_model,
			default_features = EXCLUDED.default_features,
			default_skills = EXCLUDED.default_skills,
			updated_at = NOW()
		RETURNING user_id, default_mode, default_model, default_features, default_skills, updated_at
	`
	QueryGetPreferences = `
		SELECT user_id, default_mode, default_model, default_features, default_skills, updated_at
		FROM user_preferences
		WHERE user_id = $1
	`
)

const (
	ErrCreateUser   = "failed to create user"
	ErrGetUserEmail = "failed to get user by email"
	ErrGetUser      = "failed to get user by id"
)

// API Key queries
const (
	QueryCreateApiKey   = `INSERT INTO api_keys (key_hash, prefix, name, scopes, user_id, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`
	QueryGetApiKeyByHash = `SELECT id, key_hash, prefix, name, scopes, user_id, status, created_at FROM api_keys WHERE key_hash = $1`
	QueryGetApiKeysByUser = `SELECT id, key_hash, prefix, name, scopes, user_id, status, created_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`
	QueryListApiKeys    = `SELECT id, key_hash, prefix, name, scopes, user_id, status, created_at FROM api_keys ORDER BY created_at DESC`
	QueryRevokeApiKey   = `UPDATE api_keys SET status = 'revoked' WHERE id = $1 AND status = 'active'`
	QueryGetApiKeyByID  = `SELECT id, key_hash, prefix, name, scopes, user_id, status, created_at FROM api_keys WHERE id = $1`
)

// API Key error messages
const (
	ErrCreateApiKey  = "failed to create API key"
	ErrGetApiKey     = "failed to get API key"
	ErrListApiKeys   = "failed to list API keys"
	ErrRevokeApiKey  = "failed to revoke API key"
)

const (
	MsgApiKeyCreated = "API key created successfully"
	MsgApiKeyRevoked = "API key revoked successfully"
)
