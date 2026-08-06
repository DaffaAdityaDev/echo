package middleware

import (
	"echo-backend/internal/models/config"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

func TestInternalAuthRequired(t *testing.T) {
	t.Parallel()

	secret := "service-jwt-secret"
	cfg := &cfgmodel.Config{ServiceJWTSecret: secret}

	tests := []struct {
		name       string
		setupReq   func() *http.Request
		wantStatus int
	}{
		{
			name: "valid service JWT with sub=agent passes",
			setupReq: func() *http.Request {
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
					"sub": "agent",
					"exp": time.Now().Add(time.Hour).Unix(),
				})
				tokenStr, _ := token.SignedString([]byte(secret))
				req := httptest.NewRequest("GET", "/internal/test", nil)
				req.Header.Set("Authorization", "Bearer "+tokenStr)
				return req
			},
			wantStatus: fiber.StatusOK,
		},
		{
			name: "valid JWT but sub is not agent returns 403",
			setupReq: func() *http.Request {
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
					"sub": "not-agent",
					"exp": time.Now().Add(time.Hour).Unix(),
				})
				tokenStr, _ := token.SignedString([]byte(secret))
				req := httptest.NewRequest("GET", "/internal/test", nil)
				req.Header.Set("Authorization", "Bearer "+tokenStr)
				return req
			},
			wantStatus: fiber.StatusForbidden,
		},
		{
			name: "wrong signing secret returns 401",
			setupReq: func() *http.Request {
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
					"sub": "agent",
					"exp": time.Now().Add(time.Hour).Unix(),
				})
				tokenStr, _ := token.SignedString([]byte("wrong-secret"))
				req := httptest.NewRequest("GET", "/internal/test", nil)
				req.Header.Set("Authorization", "Bearer "+tokenStr)
				return req
			},
			wantStatus: fiber.StatusUnauthorized,
		},
		{
			name: "missing Authorization header returns 401",
			setupReq: func() *http.Request {
				return httptest.NewRequest("GET", "/internal/test", nil)
			},
			wantStatus: fiber.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			app := fiber.New()
			app.Get("/internal/test", InternalAuthRequired(cfg), func(c fiber.Ctx) error {
				return c.SendStatus(fiber.StatusOK)
			})

			resp, err := app.Test(tt.setupReq())
			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)
		})
	}
}
