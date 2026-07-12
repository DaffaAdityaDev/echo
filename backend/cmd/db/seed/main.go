package main

import (
	"bufio"
	"context"
	"echo-backend/internal/config"
	"echo-backend/internal/database"
	"echo-backend/internal/models"
	"echo-backend/internal/repository"
	"log"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
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

	ctx := context.Background()
	userRepo := repository.NewUserRepository(pool)

	email := "admin@gmail.com"
	existingUser, err := userRepo.GetByEmail(ctx, email)
	if err != nil {
		log.Fatalf("Failed to check existing user: %v", err)
	}

	if existingUser != nil {
		log.Printf("User %s already exists. Skipping seeding.", email)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("root"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	adminUser := &models.User{
		Email:        email,
		PasswordHash: string(hashedPassword),
		Name:         "Admin",
		Role:         "admin",
	}

	if err := userRepo.Create(ctx, adminUser); err != nil {
		log.Fatalf("Failed to seed admin user: %v", err)
	}

	log.Println("Database seeded successfully with default admin user.")
}
