package main

import (
	"echo-backend/internal/config"
	"echo-backend/internal/database"
	"log"
)

func main() {
	if err := config.LoadDotEnv(".env"); err != nil {
		log.Println("No .env file found, using system environment variables")
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
