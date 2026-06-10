package models

// Config stores all configuration parameters for the bot and web server.
type Config struct {
	DiscordToken   string
	BackendURL     string
	ServerPort     string
	GuildID      string
}
