package auth

import (
	"context"
	authconst "echo-backend/internal/constants/auth"
	domainconst "echo-backend/internal/constants/domain"
	httpxconst "echo-backend/internal/constants/httpx"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/auth"
	"echo-backend/internal/models/config"
	authsvc "echo-backend/internal/service/auth"
	"encoding/json"
	"errors"
	"log/slog"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gofiber/fiber/v3"
)

type Service interface {
	Login(ctx context.Context, email, password, deviceLabel string) (*authmodel.User, *authsvc.TokenPair, error)
	Register(ctx context.Context, email, password, name, deviceLabel string) (*authmodel.User, *authsvc.TokenPair, error)
	RefreshAccessToken(ctx context.Context, refreshToken, deviceLabel string) (*authsvc.TokenPair, error)
	RevokeRefreshToken(ctx context.Context, refreshToken string) error
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
	Email    string `json:"email" example:"jane@example.com"` // User email address
	Password string `json:"password" example:"P@ssw0rd!23"`   // User password
}

type registerRequest struct {
	Email    string `json:"email" example:"jane@example.com"` // User email address
	Password string `json:"password" example:"P@ssw0rd!23"`   // User password
	Name     string `json:"name" example:"Jane Doe"`          // User display name
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" example:"..."` // Refresh token (or send it as the refresh_token cookie)
}

// LoginResponse is the payload returned after successful login, registration,
// or refresh. The web BFF strips both tokens and re-sets them as httpOnly
// cookies; non-browser clients use the body directly.
type LoginResponse struct {
	AccessToken  string          `json:"access_token"`  // JWT access token (15 minutes)
	RefreshToken string          `json:"refresh_token"` // Refresh token (30 days)
	ExpiresIn    int64           `json:"expires_in"`    // Access token lifetime in seconds
	User         *authmodel.User `json:"user"`          // Authenticated user profile
}

// HandleRegister godoc
// @Summary Register a new user
// @Description Creates a new user account and returns an access/refresh token pair
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body registerRequest true "Registration payload"
// @Success 200 {object} LoginResponse "Token pair and user profile"
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
	if err := validateRegister(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, err.Error())
	}

	user, pair, err := h.AuthSvc.Register(c.Context(), req.Email, req.Password, req.Name, deviceLabel(c))
	if err != nil {
		if errors.Is(err, authsvc.ErrDuplicateEmail) {
			return handlerutil.RespondError(c, fiber.StatusConflict, err.Error())
		}
		slog.Error(msgconst.ErrAuthRegister, msgconst.ComponentKey, msgconst.ComponentAuth, msgconst.KeyEmail, req.Email, msgconst.KeyErr, err)
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, msgconst.MsgAuthRegisterFailed)
	}

	h.setAuthCookies(c, pair)

	return handlerutil.RespondSuccess(c, fiber.Map{
		"access_token":  pair.AccessToken,
		"refresh_token": pair.RefreshToken,
		"expires_in":    pair.ExpiresIn,
		"user":          user,
	})
}

// HandleLogin godoc
// @Summary Login with email and password
// @Description Authenticates a user and returns an access/refresh token pair
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body loginRequest true "Login payload"
// @Success 200 {object} LoginResponse "Token pair and user profile"
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
	if err := validateLogin(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, err.Error())
	}

	user, pair, err := h.AuthSvc.Login(c.Context(), req.Email, req.Password, deviceLabel(c))
	if err != nil {
		if errors.Is(err, authsvc.ErrInvalidCredentials) {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, err.Error())
		}
		slog.Error(msgconst.ErrAuthLogin, msgconst.ComponentKey, msgconst.ComponentAuth, msgconst.KeyEmail, req.Email, msgconst.KeyErr, err)
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, msgconst.MsgAuthLoginFailed)
	}

	h.setAuthCookies(c, pair)

	return handlerutil.RespondSuccess(c, fiber.Map{
		"access_token":  pair.AccessToken,
		"refresh_token": pair.RefreshToken,
		"expires_in":    pair.ExpiresIn,
		"user":          user,
	})
}

// HandleRefresh godoc
// @Summary Refresh the token pair
// @Description Rotates the refresh token and issues a fresh access/refresh pair. The refresh token is read from the refresh_token cookie, falling back to the request body.
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body refreshRequest false "Refresh token (optional when the refresh_token cookie is present)"
// @Success 200 {object} LoginResponse "New token pair"
// @Failure 401 {object} map[string]string
// @Router /api/v1/auth/refresh [post]
func (h *Handler) HandleRefresh(c fiber.Ctx) error {
	refreshToken := c.Cookies(authconst.RefreshCookie)
	if refreshToken == "" {
		var req refreshRequest
		if body := c.Request().Body(); len(body) > 0 {
			if err := json.Unmarshal(body, &req); err == nil {
				refreshToken = req.RefreshToken
			}
		}
	}
	if refreshToken == "" {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, msgconst.ErrInvalidRefreshToken)
	}

	pair, err := h.AuthSvc.RefreshAccessToken(c.Context(), refreshToken, deviceLabel(c))
	if err != nil {
		if errors.Is(err, authsvc.ErrInvalidRefreshToken) || errors.Is(err, authsvc.ErrRefreshTokenRevoked) {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, msgconst.ErrInvalidRefreshToken)
		}
		slog.Error(msgconst.ErrAuthRefresh, msgconst.ComponentKey, msgconst.ComponentAuth, msgconst.KeyErr, err)
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, msgconst.MsgAuthRefreshFailed)
	}

	h.setAuthCookies(c, pair)

	return handlerutil.RespondSuccess(c, fiber.Map{
		"access_token":  pair.AccessToken,
		"refresh_token": pair.RefreshToken,
		"expires_in":    pair.ExpiresIn,
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
// @Description Revokes the refresh token and clears the authentication cookies
// @Tags Auth
// @Produce json
// @Param request body refreshRequest false "Refresh token (optional when the refresh_token cookie is present)"
// @Success 200 {object} map[string]string "Confirmation: {\"status\":\"success\",\"message\":\"Logged out\"}"
// @Router /api/v1/auth/logout [post]
func (h *Handler) HandleLogout(c fiber.Ctx) error {
	refreshToken := c.Cookies(authconst.RefreshCookie)
	if refreshToken == "" {
		var req refreshRequest
		if body := c.Request().Body(); len(body) > 0 {
			if err := json.Unmarshal(body, &req); err == nil {
				refreshToken = req.RefreshToken
			}
		}
	}

	// Revocation is best-effort: the cookies are cleared regardless so the
	// client can never get stuck in a logged-out state.
	if err := h.AuthSvc.RevokeRefreshToken(c.Context(), refreshToken); err != nil {
		slog.Error(msgconst.ErrAuthLogout, msgconst.ComponentKey, msgconst.ComponentAuth, msgconst.KeyErr, err)
	}

	h.clearAuthCookies(c)

	return handlerutil.RespondMessage(c, "Logged out")
}

// setAuthCookies persists the access and refresh tokens as httpOnly cookies.
// The access cookie carries the same TTL as the access token itself, so the
// cookie and the credential can never drift apart.
func (h *Handler) setAuthCookies(c fiber.Ctx, pair *authsvc.TokenPair) {
	setCookie(c, h.Cfg.Environment, authconst.TokenCookie, pair.AccessToken, authsvc.AccessTokenTTL)
	setCookie(c, h.Cfg.Environment, authconst.RefreshCookie, pair.RefreshToken, authsvc.RefreshTokenTTL)
}

func (h *Handler) clearAuthCookies(c fiber.Ctx) {
	clearCookie(c, h.Cfg.Environment, authconst.TokenCookie)
	clearCookie(c, h.Cfg.Environment, authconst.RefreshCookie)
}

func setCookie(c fiber.Ctx, environment, name, token string, ttl time.Duration) {
	c.Cookie(&fiber.Cookie{
		Name:     name,
		Value:    token,
		Expires:  time.Now().Add(ttl),
		HTTPOnly: true,
		Secure:   environment == domainconst.Production,
		SameSite: "Lax",
		Path:     "/",
	})
}

func clearCookie(c fiber.Ctx, environment, name string) {
	c.Cookie(&fiber.Cookie{
		Name:     name,
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour),
		HTTPOnly: true,
		Secure:   environment == domainconst.Production,
		SameSite: "Lax",
		Path:     "/",
	})
}

// deviceLabel identifies the client for the refresh_tokens.device_label
// column, enabling per-device session listings later. User-Agent can be
// arbitrarily long, so it is truncated.
func deviceLabel(c fiber.Ctx) string {
	ua := c.Get(httpxconst.HeaderUserAgent)
	if len(ua) > 100 {
		ua = ua[:100]
	}
	return ua
}

// validateRegister checks the shape of a registration payload before the
// service layer runs. Password minimum length is the only business rule;
// everything else guards against storing garbage in the database.
func validateRegister(req *registerRequest) error {
	email, err := validateEmail(req.Email)
	if err != nil {
		return err
	}
	req.Email = email
	if utf8.RuneCountInString(strings.TrimSpace(req.Password)) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	if strings.TrimSpace(req.Name) == "" {
		return errors.New("name is required")
	}
	return nil
}

func validateLogin(req *loginRequest) error {
	email, err := validateEmail(req.Email)
	if err != nil {
		return err
	}
	req.Email = email
	if strings.TrimSpace(req.Password) == "" {
		return errors.New("password is required")
	}
	return nil
}

func validateEmail(email string) (string, error) {
	email = strings.TrimSpace(email)
	if email == "" {
		return "", errors.New("email is required")
	}
	addr, err := mail.ParseAddress(email)
	if err != nil {
		return "", errors.New("invalid email address")
	}
	return addr.Address, nil
}
