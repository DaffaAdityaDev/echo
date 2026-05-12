package app

const (
	Name          = "Echo Backend API"
	LogFormat     = "[${time}] ${status} - ${latency} ${method} ${path}\n"
	TimeFormat    = "2006-01-02 15:04:05"
	HealthStatus  = "ok"
	HealthMessage = "Echo Backend API is running"
)

const (
	MsgNoEnvFile     = "No .env file found, using system environment variables"
	ErrServerStartup = "Failed to start server"
)
