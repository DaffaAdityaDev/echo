package database

// This file is the single source of truth for the backend schema: Migrate()
// is executed at startup and by cmd/db/migrate. The files under backend/migrations
// are legacy and are NOT executed by any code; the drift-causing LLMOps DDL
// (20260725_001_llmops_studio) was removed because its extra tables
// (eval_datasets, eval_runs, shadow_runs, audit_logs) are unreferenced by Go
// code, and its prompt_versions CHECK listed a 'shadow' status that schema.go
// did not. Any future DDL change must land here (or in a real migration tool),
// never in a second orphaned copy.

import (
	"context"
	msgconst "echo-backend/internal/constants/msg"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

const schemaVector = `
CREATE TABLE IF NOT EXISTS memory_semantic (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
`

const schemaNoVector = `
CREATE TABLE IF NOT EXISTS memory_semantic (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
`

const schemaProcedural = `
CREATE TABLE IF NOT EXISTS memory_procedural (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
`

const schemaUsers = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
`

const schemaRefreshTokens = `
CREATE TABLE IF NOT EXISTS refresh_tokens (
	id BIGSERIAL PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL UNIQUE,
	device_label TEXT NOT NULL DEFAULT '',
	expires_at TIMESTAMPTZ NOT NULL,
	revoked_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ DEFAULT NOW() 
)
`

const schemaSessions = `
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT DEFAULT '',
    context_summary TEXT DEFAULT '',
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id, updated_at DESC);
`

const schemaMessages = `
CREATE TABLE IF NOT EXISTS messages (
    id          BIGSERIAL PRIMARY KEY,
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool_result', 'thought', 'tool_call')),
    content     TEXT NOT NULL,
    token_count INTEGER DEFAULT 0,
    turn_number INTEGER NOT NULL,
    steps       JSONB,
    status      TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('streaming', 'complete', 'interrupted', 'error')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, turn_number);
`

const schemaUserPreferences = `
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_mode    TEXT DEFAULT 'standard',
    default_model   TEXT DEFAULT '',
    default_features TEXT[] DEFAULT '{}',
    default_skills  TEXT[] DEFAULT '{}',
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
`

const schemaApiKeys = `
CREATE TABLE IF NOT EXISTS api_keys (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash    TEXT          NOT NULL UNIQUE,
    prefix      TEXT          NOT NULL,
    name        TEXT          NOT NULL DEFAULT '',
    scopes      TEXT[]        DEFAULT '{}',
    user_id     TEXT          NOT NULL,
    status      TEXT          NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'revoked')),
    created_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);
`

const schemaFeatures = `
CREATE TABLE IF NOT EXISTS features (
    id VARCHAR(128) PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tier_requirement TEXT NOT NULL DEFAULT 'free' CHECK (tier_requirement IN ('free', 'pro')),
    ui_schema JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO features (id, name, description, tier_requirement, ui_schema, status) VALUES
    ('delegate_task', 'Sub-Agent Delegation', 'Enables splitting complex objectives into sub-tasks and delegating to specialist sub-agents.', 'pro', '{"render_type":"hierarchy_tree","icon":"users","primary_color":"#3b82f6"}', 'active'),
    ('web_search', 'Web Search', 'Quick search for real-time weather, prices, and news facts.', 'free', '{"render_type":"card_list","icon":"search","primary_color":"#6366f1"}', 'active'),
    ('write_todos', 'Task Planning & Execution Board', 'Updates task board list state.', 'free', '{"render_type":"kanban_board","icon":"check-square","primary_color":"#8b5cf6"}', 'active')
ON CONFLICT (id) DO NOTHING;
`

const schemaLLMOpsStudio = `
CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'local',
    name VARCHAR(128) NOT NULL,
    description TEXT,
    active_version INT DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prompt_templates_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    version INT NOT NULL,
    system_prompt TEXT NOT NULL,
    bound_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'shadow', 'approved', 'production', 'rolled_back')),
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prompt_versions_template_version UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_template ON prompt_versions(template_id, version);
`

func Migrate(pool *pgxpool.Pool) error {
	if pool == nil {
		slog.Info(msgconst.InfoNoPGSkipMigration, msgconst.ComponentKey, msgconst.ComponentDatabase)
		return nil
	}

	ctx := context.Background()

	if _, err := pool.Exec(ctx, schemaLLMOpsStudio); err != nil {
		slog.Error(msgconst.ErrCreateLLMOpsTables, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}

	if _, err := pool.Exec(ctx, schemaFeatures); err != nil {
		slog.Error(msgconst.ErrCreateFeaturesTable, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}

	if _, err := pool.Exec(ctx, schemaApiKeys); err != nil {
		return fmt.Errorf("failed to create api_keys table: %w", err)
	}
	slog.Info(msgconst.InfoCreatedAPIKeysTable, msgconst.ComponentKey, msgconst.ComponentDatabase)

	if _, err := pool.Exec(ctx, schemaUsers); err != nil {
		return fmt.Errorf("failed to create users table: %w", err)
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro'))"); err != nil {
		slog.Error(msgconst.ErrAddTierCol, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}

	if _, err := pool.Exec(ctx, schemaRefreshTokens); err != nil {
		return fmt.Errorf("failed to create refresh_tokens table: %w", err)
	}
	slog.Info(msgconst.InfoCreatedRefreshTokensTable, msgconst.ComponentKey, msgconst.ComponentDatabase)

	if _, err := pool.Exec(ctx, schemaSessions); err != nil {
		return fmt.Errorf("failed to create sessions table: %w", err)
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS strategy_version TEXT DEFAULT ''"); err != nil {
		slog.Error(msgconst.ErrAddStrategyVersionCol, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW()"); err != nil {
		slog.Error(msgconst.ErrAddLastAccessedCol, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}
	if _, err := pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_sessions_last_accessed ON sessions(last_accessed_at)"); err != nil {
		slog.Error(msgconst.ErrCreateIdxLastAccessed, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}

	const schemaAppSettings = `
	CREATE TABLE IF NOT EXISTS app_settings (
		key TEXT PRIMARY KEY,
		value JSONB NOT NULL DEFAULT '{}',
		updated_at TIMESTAMPTZ DEFAULT NOW()
	);
	INSERT INTO app_settings (key, value) VALUES ('strategy_rollout', '{}') ON CONFLICT (key) DO NOTHING;
	`
	if _, err := pool.Exec(ctx, schemaAppSettings); err != nil {
		slog.Error(msgconst.ErrCreateAppSettingsTable, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}

	if _, err := pool.Exec(ctx, schemaMessages); err != nil {
		return fmt.Errorf("failed to create messages table: %w", err)
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE messages ADD COLUMN IF NOT EXISTS steps JSONB"); err != nil {
		slog.Error(msgconst.ErrAddStepsCol, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('streaming', 'complete', 'interrupted'))"); err != nil {
		slog.Error(msgconst.ErrAddStatusCol, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_status_check"); err != nil {
		slog.Error(msgconst.ErrAddStatusCheck, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE messages ADD CONSTRAINT messages_status_check CHECK (status IN ('streaming', 'complete', 'interrupted', 'error'))"); err != nil {
		slog.Error(msgconst.ErrAddStatusCheck, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}
	if _, err := pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_messages_session_status ON messages(session_id, status)"); err != nil {
		slog.Error(msgconst.ErrCreateIdxMsgStatus, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}

	if _, err := pool.Exec(ctx, schemaUserPreferences); err != nil {
		return fmt.Errorf("failed to create user_preferences table: %w", err)
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'opencode-go'"); err != nil {
		slog.Error(msgconst.ErrAddProviderTypeCol, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS api_key TEXT DEFAULT ''"); err != nil {
		slog.Error(msgconst.ErrAddAPIKeyCol, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS base_url TEXT DEFAULT ''"); err != nil {
		slog.Error(msgconst.ErrAddBaseURLCol, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS harness_toggles JSONB DEFAULT '{}'"); err != nil {
		slog.Error(msgconst.ErrAddHarnessTogglesCol, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}

	if _, err := pool.Exec(ctx, "CREATE EXTENSION IF NOT EXISTS vector"); err != nil {
		slog.Error(msgconst.ErrCreateVectorExtension, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
	}

	_, err := pool.Exec(ctx, schemaVector)
	if err != nil {
		slog.Error(msgconst.WarnPGVectorUnavailable, msgconst.ComponentKey, msgconst.ComponentDatabase, msgconst.KeyErr, err)
		if _, err = pool.Exec(ctx, schemaNoVector); err != nil {
			return fmt.Errorf("failed to create memory_semantic: %w", err)
		}
		slog.Info(msgconst.InfoMigrationNoVector, msgconst.ComponentKey, msgconst.ComponentDatabase)
	} else {
		_, _ = pool.Exec(ctx, `
			CREATE INDEX IF NOT EXISTS idx_memory_semantic_embedding
			ON memory_semantic USING ivfflat (embedding vector_cosine_ops)
			WITH (lists = 100)
		`)
		slog.Info(msgconst.InfoMigrationWithVector, msgconst.ComponentKey, msgconst.ComponentDatabase)
	}

	if _, err = pool.Exec(ctx, schemaProcedural); err != nil {
		return fmt.Errorf("failed to create memory_procedural: %w", err)
	}

	return nil
}
