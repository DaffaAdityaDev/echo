CREATE TABLE IF NOT EXISTS user_preferences (
    user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_mode    TEXT DEFAULT 'standard',
    default_model   TEXT DEFAULT '',
    default_features TEXT[] DEFAULT '{}',
    default_skills  TEXT[] DEFAULT '{}',
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
