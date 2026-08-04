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
