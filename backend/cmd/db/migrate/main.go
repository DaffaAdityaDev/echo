package main

import (
	"bufio"
	"echo-backend/internal/config"
	"echo-backend/internal/database"
	"log"
	"os"
	"strings"
)

func main() {
	// Load .env file
	if f, err := os.Open(".env"); err == nil {
		defer f.Close()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				val = strings.Trim(val, `"'`)
				if _, ok := os.LookupEnv(key); !ok {
					os.Setenv(key, val)
				}
			}
		}
	}

	cfg := config.Load()

	pool := database.NewPostgresPool(cfg)
	if pool == nil {
		log.Fatal("DATABASE_URL not set or database pool initialization failed")
	}
	defer pool.Close()

	if err := database.Migrate(pool); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Database migration completed successfully.")
}
