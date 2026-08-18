package middleware

import (
	"context"
	authconst "echo-backend/internal/constants/auth"
	domainconst "echo-backend/internal/constants/domain"
	"echo-backend/internal/constants/locals"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

func TestAuthRequiredTier(t *testing.T) {
	t.Parallel()

	secret := "user-jwt-secret"

	validClaims := func() jwt.MapClaims {
		return jwt.MapClaims{
			authconst.ClaimSubject: "7",
			authconst.ClaimRole:    domainconst.RoleUser,
			authconst.ClaimEmail:   "jane@example.com",
			authconst.ClaimExp:     time.Now().Add(time.Hour).Unix(),
		}
	}

	tests := []struct {
		name        string
		tokenClaims jwt.MapClaims
		signingKey  string
		useCookie   bool
		resolveTier string
		wantStatus  int
		wantSub     string
		wantTier    string
		wantRole    any
	}{
		{
			name:        "valid token resolves tier and populates locals",
			tokenClaims: validClaims(),
			signingKey:  secret,
			resolveTier: "pro",
			wantStatus:  fiber.StatusOK,
			wantSub:     "7",
			wantTier:    "pro",
			wantRole:    domainconst.RoleUser,
		},
		{
			name:        "unknown resolver tier fails closed to free",
			tokenClaims: validClaims(),
			signingKey:  secret,
			resolveTier: "platinum",
			wantStatus:  fiber.StatusOK,
			wantSub:     "7",
			wantTier:    "free",
			wantRole:    domainconst.RoleUser,
		},
		{
			name: "missing sub resolves tier for empty id",
			tokenClaims: jwt.MapClaims{
				authconst.ClaimRole: domainconst.RoleUser,
				authconst.ClaimExp:  time.Now().Add(time.Hour).Unix(),
			},
			signingKey:  secret,
			resolveTier: "pro",
			wantStatus:  fiber.StatusOK,
			wantSub:     "",
			wantTier:    "pro",
			wantRole:    domainconst.RoleUser,
		},
		{
			name:        "token via cookie passes",
			tokenClaims: validClaims(),
			signingKey:  secret,
			useCookie:   true,
			resolveTier: "free",
			wantStatus:  fiber.StatusOK,
			wantSub:     "7",
			wantTier:    "free",
			wantRole:    domainconst.RoleUser,
		},
		{
			name:        "invalid signature returns 401",
			tokenClaims: validClaims(),
			signingKey:  "wrong-secret",
			wantStatus:  fiber.StatusUnauthorized,
		},
		{
			name:       "missing token returns 401",
			wantStatus: fiber.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var gotSub string
			var gotTier, gotRole any
			resolver := func(_ context.Context, sub string) string {
				gotSub = sub
				return tt.resolveTier
			}

			app := fiber.New()
			app.Get("/auth", AuthRequired(secret, resolver), func(c fiber.Ctx) error {
				gotTier = UserTier(c)
				gotRole = c.Locals(locals.UserRole)
				return c.SendStatus(fiber.StatusOK)
			})

			req := httptest.NewRequest(http.MethodGet, "/auth", nil)
			if tt.tokenClaims != nil {
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, tt.tokenClaims)
				tokenStr, _ := token.SignedString([]byte(tt.signingKey))
				if tt.useCookie {
					req.AddCookie(&http.Cookie{Name: authconst.TokenCookie, Value: tokenStr})
				} else {
					req.Header.Set(authconst.HeaderAuthorization, authconst.BearerPrefix+tokenStr)
				}
			}

			resp, err := app.Test(req)
			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)

			if tt.wantStatus == fiber.StatusOK {
				assert.Equal(t, tt.wantSub, gotSub)
				assert.Equal(t, tt.wantTier, gotTier)
				assert.Equal(t, tt.wantRole, gotRole)
			}
		})
	}
}
