INSERT INTO app_settings (key, value) VALUES ('prompt_template_name', '{}') ON CONFLICT (key) DO NOTHING;
