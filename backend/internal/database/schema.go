package database

import (
	"context"
	"fmt"
	"log"

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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
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
    status      TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('streaming', 'complete', 'interrupted')),
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

func Migrate(pool *pgxpool.Pool) error {
	if pool == nil {
		log.Println("No PostgreSQL connection, skipping migration")
		return nil
	}

	ctx := context.Background()

	if _, err := pool.Exec(ctx, schemaApiKeys); err != nil {
		return fmt.Errorf("failed to create api_keys table: %w", err)
	}
	log.Println("Created api_keys table")

	if _, err := pool.Exec(ctx, schemaUsers); err != nil {
		return fmt.Errorf("failed to create users table: %w", err)
	}

	if _, err := pool.Exec(ctx, schemaSessions); err != nil {
		return fmt.Errorf("failed to create sessions table: %w", err)
	}

	if _, err := pool.Exec(ctx, schemaMessages); err != nil {
		return fmt.Errorf("failed to create messages table: %w", err)
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE messages ADD COLUMN IF NOT EXISTS steps JSONB"); err != nil {
		log.Printf("failed to add steps column to messages: %v", err)
	}
	if _, err := pool.Exec(ctx, "ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('streaming', 'complete', 'interrupted'))"); err != nil {
		log.Printf("failed to add status column to messages: %v", err)
	}
	if _, err := pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_messages_session_status ON messages(session_id, status)"); err != nil {
		log.Printf("failed to create idx_messages_session_status: %v", err)
	}

	if _, err := pool.Exec(ctx, schemaUserPreferences); err != nil {
		return fmt.Errorf("failed to create user_preferences table: %w", err)
	}

	if _, err := pool.Exec(ctx, "CREATE EXTENSION IF NOT EXISTS vector"); err != nil {
		log.Printf("failed to create vector extension: %v", err)
	}

	hasVector := false
	_, err := pool.Exec(ctx, schemaVector)
	if err != nil {
		log.Printf("pgvector not available, creating memory_semantic without embedding: %v", err)
		_, err = pool.Exec(ctx, schemaNoVector)
		if err != nil {
			return fmt.Errorf("failed to create memory_semantic: %w", err)
		}
	} else {
		hasVector = true
		_, _ = pool.Exec(ctx, `
			CREATE INDEX IF NOT EXISTS idx_memory_semantic_embedding
			ON memory_semantic USING ivfflat (embedding vector_cosine_ops)
			WITH (lists = 100)
		`)
	}

	_, err = pool.Exec(ctx, schemaProcedural)
	if err != nil {
		return fmt.Errorf("failed to create memory_procedural: %w", err)
	}

	if hasVector {
		log.Println("Database migration completed with pgvector support")
	} else {
		log.Println("Database migration completed (without pgvector)")
	}

	return nil
}
