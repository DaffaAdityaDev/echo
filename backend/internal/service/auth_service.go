package service

import (
	"echo-backend/internal/models"
	"echo-backend/internal/repository"
)

type AuthService interface {
	// Add auth-related business logic here
}

type authService struct {
	cfg      *models.Config
	userRepo repository.UserRepository
}

func NewAuthService(cfg *models.Config, userRepo repository.UserRepository) AuthService {
	return &authService{
		cfg:      cfg,
		userRepo: userRepo,
	}
}
