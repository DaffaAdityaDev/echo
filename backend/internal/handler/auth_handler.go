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
	Email    string `json:"email" example:"jane@example.com"`
	Password string `json:"password" example:"P@ssw0rd!23"`
}

type registerRequest struct {
	Email    string `json:"email" example:"jane@example.com"`
	Password string `json:"password" example:"P@ssw0rd!23"`
	Name     string `json:"name" example:"Jane Doe"`
}

// @Summary Register user
// @Description Register a new user account with email, password, and name
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body registerRequest true "Registration credentials"
// @Success 200 {object} map[string]interface{} "User and Token"
// @Failure 400 {object} map[string]string "Invalid request body"
// @Failure 409 {object} map[string]string "Email already exists"
// @Router /api/v1/auth/register [post]
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

// @Summary Login user
// @Description Authenticate user and receive JWT token and session cookie
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body loginRequest true "Login credentials"
// @Success 200 {object} map[string]interface{} "User and Token"
// @Failure 400 {object} map[string]string "Invalid request body"
// @Failure 401 {object} map[string]string "Invalid email or password"
// @Router /api/v1/auth/login [post]
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

// @Summary Get current user profile
// @Description Fetch profile info for the currently authenticated user
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} models.User
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 404 {object} map[string]string "User not found"
// @Router /api/v1/auth/me [get]
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

// @Summary Logout user
// @Description Invalidate the session cookie
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]string "Logged out"
// @Router /api/v1/auth/logout [post]
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


