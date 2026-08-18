package db

// Feature queries (owner: repository/features)
const (
	QueryListActiveFeatures = `
		SELECT id, name, description, tier_requirement, ui_schema, status, created_at, updated_at
		FROM features
		WHERE status = 'active'
		ORDER BY id
	`
)
