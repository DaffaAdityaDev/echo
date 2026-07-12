package handler

import (
	"echo-backend/internal/models"
	"echo-backend/internal/service"
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v3"
)

type AuthHandler struct {
	Cfg     *models.Config
	AuthSvc *service.AuthService
}

func NewAuthHandler(cfg *models.Config, authSvc *service.AuthService) *AuthHandler {
	return &AuthHandler{
		Cfg:     cfg,
		AuthSvc: authSvc,
	}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func (h *AuthHandler) HandleRegister(c fiber.Ctx) error {
	var req registerRequest
	body := c.Request().Body()
	if len(body) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Empty body"})
	}
	if err := json.Unmarshal(body, &req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request: " + err.Error()})
	}

	user, token, err := h.AuthSvc.Register(c.Context(), req.Email, req.Password, req.Name)
	if err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	}

	setAuthCookie(c, h.Cfg.Environment, token)

	return c.JSON(fiber.Map{
		"token": token,
		"user":  user,
	})
}

func (h *AuthHandler) HandleLogin(c fiber.Ctx) error {
	var req loginRequest
	body := c.Request().Body()
	if len(body) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Empty body"})
	}
	if err := json.Unmarshal(body, &req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request: " + err.Error()})
	}

	user, token, err := h.AuthSvc.Login(c.Context(), req.Email, req.Password)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	setAuthCookie(c, h.Cfg.Environment, token)

	return c.JSON(fiber.Map{
		"token": token,
		"user":  user,
	})
}

func (h *AuthHandler) HandleMe(c fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	user, err := h.AuthSvc.GetUserByID(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get user"})
	}
	if user == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(user)
}

func (h *AuthHandler) HandleLogout(c fiber.Ctx) error {
	c.Cookie(&fiber.Cookie{
		Name:     "auth_token",
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour),
		HTTPOnly: true,
		Secure:   h.Cfg.Environment == "production",
		SameSite: "Lax",
		Path:     "/",
	})

	return c.JSON(fiber.Map{"message": "Logged out"})
}

func setAuthCookie(c fiber.Ctx, environment, token string) {
	c.Cookie(&fiber.Cookie{
		Name:     "auth_token",
		Value:    token,
		Expires:  time.Now().Add(72 * time.Hour),
		HTTPOnly: true,
		Secure:   environment == "production",
		SameSite: "Lax",
		Path:     "/",
	})
}
