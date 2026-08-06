package auth

import (
	"context"
	"echo-backend/internal/models/auth"
	"echo-backend/internal/models/config"
	"echo-backend/internal/repository/auth"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	cfg      *cfgmodel.Config
	userRepo *auth.Repository
}

func NewService(cfg *cfgmodel.Config, userRepo *auth.Repository) *Service {
	return &Service{
		cfg:      cfg,
		userRepo: userRepo,
	}
}

func (s *Service) Login(ctx context.Context, email, password string) (*authmodel.User, string, error) {
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, "", fmt.Errorf("invalid email or password")
	}
	if user == nil {
		return nil, "", fmt.Errorf("invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, "", fmt.Errorf("invalid email or password")
	}

	token, err := generateToken(s.cfg, user)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate token: %w", err)
	}

	return user, token, nil
}

func (s *Service) Register(ctx context.Context, email, password, name string) (*authmodel.User, string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", fmt.Errorf("failed to hash password: %w", err)
	}

	user := &authmodel.User{
		Email:        email,
		PasswordHash: string(hashedPassword),
		Name:         name,
		Role:         "user",
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, "", fmt.Errorf("failed to create user: %w", err)
	}

	token, err := generateToken(s.cfg, user)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate token: %w", err)
	}

	return user, token, nil
}

func (s *Service) GetUserByID(ctx context.Context, id int) (*authmodel.User, error) {
	return s.userRepo.GetUserByID(ctx, id)
}

func generateToken(cfg *cfgmodel.Config, user *authmodel.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":  strconv.Itoa(user.ID),
		"role": user.Role,
		"exp":  time.Now().Add(72 * time.Hour).Unix(),
		"iat":  time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}
