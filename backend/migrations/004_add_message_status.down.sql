DROP INDEX IF EXISTS idx_messages_session_status;
ALTER TABLE messages DROP COLUMN IF EXISTS status;
