ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('streaming', 'complete', 'interrupted'));
CREATE INDEX IF NOT EXISTS idx_messages_session_status ON messages(session_id, status);
