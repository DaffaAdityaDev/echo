package auth

import (
	"context"
	authconst "echo-backend/internal/constants/auth"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/auth"
	"echo-backend/internal/models/config"
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v3"
)

type Service interface {
	Login(ctx context.Context, email, password string) (*authmodel.User, string, error)
	Register(ctx context.Context, email, password, name string) (*authmodel.User, string, error)
	GetUserByID(ctx context.Context, id int) (*authmodel.User, error)
}

type Handler struct {
	Cfg     *cfgmodel.Config
	AuthSvc Service
}

func NewHandler(cfg *cfgmodel.Config, authSvc Service) *Handler {
	return &Handler{
		Cfg:     cfg,
		AuthSvc: authSvc,
	}
}

type loginRequest struct {
	Email    string `json:"email" binding:"required" example:"jane@example.com"` // User email address
	Password string `json:"password" binding:"required" example:"P@ssw0rd!23"`   // User password
}

type registerRequest struct {
	Email    string `json:"email" binding:"required" example:"jane@example.com"` // User email address
	Password string `json:"password" binding:"required" example:"P@ssw0rd!23"`   // User password
	Name     string `json:"name" binding:"required" example:"Jane Doe"`          // User display name
}

// LoginResponse is the payload returned after successful login or registration.
type LoginResponse struct {
	Token string          `json:"token"` // JWT access token (also set as an HTTP-only cookie)
	User  *authmodel.User `json:"user"`  // Authenticated user profile
}

// HandleRegister godoc
// @Summary Register a new user
// @Description Creates a new user account and returns a JWT token
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body registerRequest true "Registration payload"
// @Success 200 {object} LoginResponse "Token and user profile"
// @Failure 400 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Router /api/v1/auth/register [post]
func (h *Handler) HandleRegister(c fiber.Ctx) error {
	var req registerRequest
	body := c.Request().Body()
	if len(body) == 0 {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Empty body")
	}
	if err := json.Unmarshal(body, &req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request: "+err.Error())
	}

	user, token, err := h.AuthSvc.Register(c.Context(), req.Email, req.Password, req.Name)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusConflict, err.Error())
	}

	setAuthCookie(c, h.Cfg.Environment, token)

	return handlerutil.RespondSuccess(c, fiber.Map{
		"token": token,
		"user":  user,
	})
}

// HandleLogin godoc
// @Summary Login with email and password
// @Description Authenticates a user and returns a JWT token
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body loginRequest true "Login payload"
// @Success 200 {object} LoginResponse "Token and user profile"
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /api/v1/auth/login [post]
func (h *Handler) HandleLogin(c fiber.Ctx) error {
	var req loginRequest
	body := c.Request().Body()
	if len(body) == 0 {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Empty body")
	}
	if err := json.Unmarshal(body, &req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request: "+err.Error())
	}

	user, token, err := h.AuthSvc.Login(c.Context(), req.Email, req.Password)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, err.Error())
	}

	setAuthCookie(c, h.Cfg.Environment, token)

	return handlerutil.RespondSuccess(c, fiber.Map{
		"token": token,
		"user":  user,
	})
}

// HandleMe godoc
// @Summary Get current user
// @Description Returns the authenticated user's profile
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} authmodel.User
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/auth/me [get]
func (h *Handler) HandleMe(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	user, err := h.AuthSvc.GetUserByID(c.Context(), userID)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to get user")
	}
	if user == nil {
		return handlerutil.RespondError(c, fiber.StatusNotFound, "User not found")
	}

	return handlerutil.RespondSuccess(c, user)
}

// HandleLogout godoc
// @Summary Logout
// @Description Clears the authentication cookie
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]string "Confirmation: {\"status\":\"success\",\"message\":\"Logged out\"}"
// @Router /api/v1/auth/logout [post]
func (h *Handler) HandleLogout(c fiber.Ctx) error {
	c.Cookie(&fiber.Cookie{
		Name:     authconst.TokenCookie,
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour),
		HTTPOnly: true,
		Secure:   h.Cfg.Environment == "production",
		SameSite: "Lax",
		Path:     "/",
	})

	return handlerutil.RespondMessage(c, "Logged out")
}

func setAuthCookie(c fiber.Ctx, environment, token string) {
	c.Cookie(&fiber.Cookie{
		Name:     authconst.TokenCookie,
		Value:    token,
		Expires:  time.Now().Add(72 * time.Hour),
		HTTPOnly: true,
		Secure:   environment == "production",
		SameSite: "Lax",
		Path:     "/",
	})
}
