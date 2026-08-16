package app

const (
	Name          = "Echo Backend API"
	LogFormat     = "[${time}] ${status} ${method} ${white}${path}${reset} ip=${ip} route=${route} latency=${latency} in=${bytesReceived}B out=${bytesSent}B ${magenta}ua=${ua}${reset} err=${error}\n"
	LogTimeFormat = "2006-01-02 15:04:05.000"
	// LogFormatJSON is the machine-readable access log used in production:
	// one JSON object per line, free of ANSI escape codes so log collectors
	// can parse it without stripping colors.
	LogFormatJSON     = `{"time":"${time}","pid":${pid},"status":${status},"method":"${method}","path":"${path}","route":"${route}","ip":"${ip}","latency":"${latency}","in":${bytesReceived},"out":${bytesSent},"ua":"${ua}","err":"${error}"}` + "\n"
	LogTimeFormatJSON = "2006-01-02T15:04:05.000Z"
	HealthStatus      = "ok"
	HealthMessage     = "Echo Backend API is running"
)

const (
	MsgNoEnvFile     = "No .env file found, using system environment variables"
	ErrServerStartup = "Failed to start server"
)
