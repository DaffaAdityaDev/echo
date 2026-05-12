package repository

import (
	"echo-backend/internal/database"
)

type UserRepository interface {
	// Add user-related methods here
}

type userRepository struct {
	infra *database.Infrastructure
}

func NewUserRepository(infra *database.Infrastructure) UserRepository {
	return &userRepository{infra: infra}
}
