DROP INDEX IF EXISTS idx_sessions_last_accessed;
ALTER TABLE sessions DROP COLUMN IF EXISTS last_accessed_at;
