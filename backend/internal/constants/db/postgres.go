package db

const (
	DefaultSessionTitle = "New Chat"
)

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
		INSERT INTO sessions (user_id, title, context_summary, status, strategy_version, last_accessed_at, created_at, updated_at)
		VALUES ($1, $2, '', 'active', $3, NOW(), NOW(), NOW())
		RETURNING id, user_id, title, context_summary, status, COALESCE(strategy_version, ''), COALESCE(last_accessed_at, NOW()), created_at, updated_at
	`
	QueryListSessions = `
		SELECT s.id, s.user_id, s.title, s.context_summary, s.status, COALESCE(s.strategy_version, ''), COALESCE(s.last_accessed_at, s.updated_at), s.created_at, s.updated_at,
		       COUNT(m.id) as message_count,
		       COALESCE(SUM(m.token_count), 0) as token_count
		FROM sessions s
		LEFT JOIN messages m ON m.session_id = s.id
		WHERE s.user_id = $1 AND s.status = 'active'
		GROUP BY s.id, s.user_id, s.title, s.context_summary, s.status, s.strategy_version, s.last_accessed_at, s.created_at, s.updated_at
		ORDER BY s.updated_at DESC, s.id DESC
		LIMIT NULLIF($2, 0) OFFSET $3
	`
	QueryGetSession = `
		SELECT s.id, s.user_id, s.title, s.context_summary, s.status, COALESCE(s.strategy_version, ''), COALESCE(s.last_accessed_at, s.updated_at), s.created_at, s.updated_at
		FROM sessions s
		WHERE s.id = $1
	`
	QueryPinSessionStrategyVersion = `
		UPDATE sessions
		SET strategy_version = $2
		WHERE id = $1 AND (strategy_version = '' OR strategy_version IS NULL)
	`
	QueryTouchSession = `
		UPDATE sessions
		SET last_accessed_at = NOW()
		WHERE id = $1
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
		WITH msg_sub AS (
			SELECT id, session_id, role, content, token_count, turn_number, COALESCE(steps, 'null') as steps, status, created_at
			FROM messages
			WHERE session_id = $1
			ORDER BY turn_number DESC, id DESC
			LIMIT NULLIF($2, 0) OFFSET $3
		)
		SELECT id, session_id, role, content, token_count, turn_number, steps, status, created_at FROM msg_sub
		ORDER BY turn_number ASC, id ASC
	`
	QueryGetSessionMessagesAscending = `
		WITH msg_sub AS (
			SELECT id, session_id, role, content, token_count, turn_number, COALESCE(steps, 'null') as steps, status, created_at
			FROM messages
			WHERE session_id = $1
			ORDER BY turn_number ASC, id ASC
			LIMIT NULLIF($2, 0)
		)
		SELECT id, session_id, role, content, token_count, turn_number, steps, status, created_at FROM msg_sub
		ORDER BY turn_number ASC, id ASC
	`
	QueryCountSessions = `
		SELECT COUNT(*)
		FROM sessions
		WHERE user_id = $1 AND status = 'active'
	`
	QueryCountMessages = `
		SELECT COUNT(*)
		FROM messages
		WHERE session_id = $1
	`
	QueryInsertMessageWithStatus = `
		INSERT INTO messages (session_id, role, content, token_count, turn_number, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		RETURNING id
	`
	QueryInsertAssistantPlaceholder = `
		INSERT INTO messages (session_id, role, content, token_count, turn_number, status, created_at)
		VALUES ($1, 'assistant', '', 0, $2, 'streaming', NOW())
		RETURNING id
	`
	QueryUpdateMessageContent = `
		UPDATE messages
		SET content = $2, steps = COALESCE($3, steps), token_count = $4
		WHERE id = $1 AND status != 'complete'
	`
	QueryUpdateMessageStatus = `
		UPDATE messages
		SET status = $2
		WHERE id = $1 AND status != 'complete'
	`
	QueryMarkSessionStreamingInterrupted = `
		UPDATE messages
		SET status = 'interrupted'
		WHERE session_id = $1 AND status = 'streaming'
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
	QueryUpdateSessionUpdatedAt = `
		UPDATE sessions
		SET updated_at = NOW()
		WHERE id = $1
	`
	QueryGetAppSetting = `
		SELECT key, value, updated_at
		FROM app_settings
		WHERE key = $1
	`
	QueryUpsertAppSetting = `
		INSERT INTO app_settings (key, value, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (key)
		DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		RETURNING key, value, updated_at
	`
	QueryScanSessionsForConsolidation = `
		SELECT s.id, s.user_id, COALESCE(SUM(m.token_count), 0) as token_count
		FROM sessions s
		LEFT JOIN messages m ON m.session_id = s.id
		WHERE s.status = 'active' AND s.updated_at < $1
		GROUP BY s.id, s.user_id
		HAVING COALESCE(SUM(m.token_count), 0) >= $2
		LIMIT $3
	`
	QueryScanSessionsForArchive = `
		UPDATE sessions
		SET status = 'archived', updated_at = NOW()
		WHERE status = 'active' AND COALESCE(last_accessed_at, updated_at) < $1
		RETURNING id
	`
	QueryDeleteMessagesForArchivedSessions = `
		DELETE FROM messages
		WHERE session_id IN (
			SELECT id FROM sessions
			WHERE status = 'archived' AND COALESCE(last_accessed_at, updated_at) < $1
		)
	`
	QueryScanSessionsForDeprecate = `
		SELECT id
		FROM sessions
		WHERE status = 'active'
		  AND COALESCE(last_accessed_at, updated_at) < $1
		  AND COALESCE(last_accessed_at, updated_at) >= $2
	`
)

const (
	QueryUpsertPreferences = `
		INSERT INTO user_preferences (user_id, default_mode, default_model, default_features, default_skills, provider_type, api_key, base_url, harness_toggles, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		ON CONFLICT (user_id)
		DO UPDATE SET
			default_mode = EXCLUDED.default_mode,
			default_model = EXCLUDED.default_model,
			default_features = EXCLUDED.default_features,
			default_skills = EXCLUDED.default_skills,
			provider_type = EXCLUDED.provider_type,
			api_key = EXCLUDED.api_key,
			base_url = EXCLUDED.base_url,
			harness_toggles = EXCLUDED.harness_toggles,
			updated_at = NOW()
		RETURNING user_id, default_mode, default_model, default_features, default_skills, provider_type, api_key, base_url, harness_toggles, updated_at
	`
	QueryGetPreferences = `
		SELECT user_id, default_mode, default_model, default_features, default_skills, provider_type, api_key, base_url, harness_toggles, updated_at
		FROM user_preferences
		WHERE user_id = $1
	`
)

const (
	ErrCreateUser = "failed to create user"
	ErrGetUser    = "failed to get user by id"
)

// Feature queries
const (
	QueryListActiveFeatures = `
		SELECT id, name, description, tier_requirement, ui_schema, status, created_at, updated_at
		FROM features
		WHERE status = 'active'
		ORDER BY id
	`
)

// API Key queries
const (
	QueryCreateApiKey    = `INSERT INTO api_keys (key_hash, prefix, name, scopes, user_id, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`
	QueryGetApiKeyByHash = `SELECT id, key_hash, prefix, name, scopes, user_id, status, created_at FROM api_keys WHERE key_hash = $1`
	QueryListApiKeys     = `SELECT id, key_hash, prefix, name, scopes, user_id, status, created_at FROM api_keys ORDER BY created_at DESC`
	QueryRevokeApiKey    = `UPDATE api_keys SET status = 'revoked' WHERE id = $1 AND status = 'active'`
	QueryGetApiKeyByID   = `SELECT id, key_hash, prefix, name, scopes, user_id, status, created_at FROM api_keys WHERE id = $1`
)

// API Key error messages
const (
	ErrCreateApiKey = "failed to create API key"
	ErrGetApiKey    = "failed to get API key"
	ErrListApiKeys  = "failed to list API keys"
	ErrRevokeApiKey = "failed to revoke API key"
)
