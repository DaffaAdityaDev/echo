CREATE INDEX IF NOT EXISTS idx_sessions_status_updated_at
    ON sessions (status, updated_at);

-- Covers the lifecycle scans, which filter status='active' plus
-- COALESCE(last_accessed_at, updated_at): a plain (last_accessed_at) index
-- is defeated by the COALESCE expression.
CREATE INDEX IF NOT EXISTS idx_sessions_status_last_accessed
    ON sessions (status, (COALESCE(last_accessed_at, updated_at)));

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_memory_semantic_content_trgm
    ON memory_semantic USING gin (content gin_trgm_ops);
