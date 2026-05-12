package db

const (
	MsgPostgresConnected = "Connected to PostgreSQL successfully"
	ErrPostgresConfig    = "unable to parse database config"
	ErrPostgresPool      = "unable to create connection pool"
	ErrPostgresPing      = "unable to ping database"
)

const (
	QueryCreateUser = `
		INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	QueryGetUserByEmail = `
		SELECT id, email, password_hash, name, role, created_at, updated_at
		FROM users
		WHERE email = $1
	`
)

const (
	ErrCreateUser   = "failed to create user"
	ErrGetUserEmail = "failed to get user by email"
)
