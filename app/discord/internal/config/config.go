package config

import (
	"bufio"
	"magi/internal/models"
	"os"
	"strings"
)

// Load initializes and returns the Config model.
func Load() *models.Config {
	// Attempt to load .env for local development
	_ = loadEnv(".env")

	serverPort := getEnv("PORT", ":8081")
	if !strings.HasPrefix(serverPort, ":") {
		serverPort = ":" + serverPort
	}

	backendURL := getEnv("BACKEND_URL", "http://localhost:8080")

	return &models.Config{
		DiscordToken: os.Getenv("DISCORD_TOKEN"),
		BackendURL:   backendURL,
		ServerPort:   serverPort,
		GuildID:      getEnv("GUILD_ID", os.Getenv("ALLOWED_GUILD_ID")),
	}
}

// getEnv retrieves environment variables or falls back to a default value.
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// loadEnv parses a key-value file and sets environment variables if they are not already defined.
func loadEnv(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.Trim(strings.TrimSpace(parts[1]), `"'`)

		if os.Getenv(key) == "" {
			_ = os.Setenv(key, value)
		}
	}

	return scanner.Err()
}
