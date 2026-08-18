package db

// User queries (owner: repository/auth)
const (
	QueryCreateUser = `
		INSERT INTO users (email, password_hash, name, role, tier, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	QueryGetUserByEmail = `
		SELECT id, email, password_hash, name, role, tier, created_at, updated_at
		FROM users
		WHERE email = $1
	`
)

const (
	QueryGetUserByID = `
		SELECT id, email, password_hash, name, role, tier, created_at, updated_at
		FROM users
		WHERE id = $1
	`
)

const (
	ErrCreateUser = "failed to create user"
	ErrGetUser    = "failed to get user by id"
)
