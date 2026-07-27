package auth

import (
	"context"
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
	Email    string `json:"email" example:"jane@example.com"`
	Password string `json:"password" example:"P@ssw0rd!23"`
}

type registerRequest struct {
	Email    string `json:"email" example:"jane@example.com"`
	Password string `json:"password" example:"P@ssw0rd!23"`
	Name     string `json:"name" example:"Jane Doe"`
}

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

func (h *Handler) HandleLogout(c fiber.Ctx) error {
	c.Cookie(&fiber.Cookie{
		Name:     "auth_token",
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
		Name:     "auth_token",
		Value:    token,
		Expires:  time.Now().Add(72 * time.Hour),
		HTTPOnly: true,
		Secure:   environment == "production",
		SameSite: "Lax",
		Path:     "/",
	})
}
