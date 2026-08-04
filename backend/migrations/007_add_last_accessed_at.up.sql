ALTER TABLE sessions ADD COLUMN last_accessed_at TIMESTAMPTZ DEFAULT NOW();
UPDATE sessions SET last_accessed_at = updated_at;
CREATE INDEX idx_sessions_last_accessed ON sessions (last_accessed_at);
