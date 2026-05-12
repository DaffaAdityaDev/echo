package handler

import (
	"echo-backend/internal/models"
	"echo-backend/internal/service"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

type AuthHandler struct {
	Cfg     *models.Config
	AuthSvc service.AuthService
}

func NewAuthHandler(cfg *models.Config, authSvc service.AuthService) *AuthHandler {
	return &AuthHandler{
		Cfg:     cfg,
		AuthSvc: authSvc,
	}
}

func (h *AuthHandler) HandleRegister(c fiber.Ctx) error {
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{
		"error": "Not implemented yet",
	})
}

func (h *AuthHandler) HandleLogin(c fiber.Ctx) error {
	// Mock successful authentication for user ID 1
	userID := "1"

	// 1. Create JWT claims
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(time.Hour * 72).Unix(),
		"iat": time.Now().Unix(),
	})

	// 2. Sign token
	tokenString, err := token.SignedString([]byte(h.Cfg.JWTSecret))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate token",
		})
	}

	// 3. Set Secure HttpOnly Cookie
	c.Cookie(&fiber.Cookie{
		Name:     "auth_token",
		Value:    tokenString,
		Expires:  time.Now().Add(time.Hour * 72),
		HTTPOnly: true,
		Secure:   h.Cfg.Environment == "production", // Only over HTTPS in production
		SameSite: "Lax",
		Path:     "/",
	})

	return c.JSON(fiber.Map{
		"token": tokenString, // Still return token for client-side storage if preferred
		"user": fiber.Map{
			"id":    userID,
			"name":  "Test User",
			"email": "test@example.com",
		},
	})
}
