package db

// Settings queries: user_preferences and app_settings (owner: repository/settings)
const (
	QueryUpsertPreferences = `
		INSERT INTO user_preferences (user_id, default_mode, default_model, default_features, default_skills, provider_type, api_key, base_url, harness_toggles, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		ON CONFLICT (user_id)
		DO UPDATE SET
			default_mode = EXCLUDED.default_mode,
			default_model = EXCLUDED.default_model,
			default_features = EXCLUDED.default_features,
			default_skills = EXCLUDED.default_skills,
			provider_type = EXCLUDED.provider_type,
			api_key = EXCLUDED.api_key,
			base_url = EXCLUDED.base_url,
			harness_toggles = EXCLUDED.harness_toggles,
			updated_at = NOW()
		RETURNING user_id, default_mode, default_model, default_features, default_skills, provider_type, api_key, base_url, harness_toggles, updated_at
	`
	QueryGetPreferences = `
		SELECT user_id, default_mode, default_model, default_features, default_skills, provider_type, api_key, base_url, harness_toggles, updated_at
		FROM user_preferences
		WHERE user_id = $1
	`
)

const (
	QueryGetAppSetting = `
		SELECT key, value, updated_at
		FROM app_settings
		WHERE key = $1
	`
	QueryUpsertAppSetting = `
		INSERT INTO app_settings (key, value, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (key)
		DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		RETURNING key, value, updated_at
	`
)
