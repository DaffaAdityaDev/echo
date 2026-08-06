package app

const (
	Name          = "Echo Backend API"
	LogFormat     = "[${time}] ${status} - ${latency} ${method} ${path}\n"
	HealthStatus  = "ok"
	HealthMessage = "Echo Backend API is running"
)

const (
	MsgNoEnvFile     = "No .env file found, using system environment variables"
	ErrServerStartup = "Failed to start server"
)
