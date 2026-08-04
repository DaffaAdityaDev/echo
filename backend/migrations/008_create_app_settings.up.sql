CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES ('strategy_rollout', '{}') ON CONFLICT (key) DO NOTHING;
