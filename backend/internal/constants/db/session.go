package db

// Session and message queries (owner: repository/session, handler/session, worker)
const (
	DefaultSessionTitle = "New Chat"
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
	// Token count takes the larger of the stored count and a content-length
	// estimate: stored token_count can under-report (e.g. load-test messages
	// inserted without accurate counts), which would let oversized sessions
	// slip past consolidation guards and blow the provider context window.
	QueryGetSessionTokenCount = `
		SELECT COALESCE(SUM(GREATEST(m.token_count, CEIL(LENGTH(m.content) / 4.0))), 0)
		FROM messages m
		WHERE m.session_id = $1
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
	QueryScanSessionsForConsolidation = `
		SELECT s.id, s.user_id, COALESCE(SUM(m.token_count), 0) as token_count
		FROM sessions s
		LEFT JOIN messages m ON m.session_id = s.id
		WHERE s.status = 'active' AND s.updated_at < $1
		GROUP BY s.id, s.user_id
		HAVING COALESCE(SUM(GREATEST(m.token_count, CEIL(LENGTH(m.content) / 4.0))), 0) >= $2
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
