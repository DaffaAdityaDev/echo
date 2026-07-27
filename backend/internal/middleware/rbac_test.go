package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
)

func TestRequireRoles(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		allowedRoles []string
		setupReq     func() *http.Request
		wantStatus   int
	}{
		{
			name:         "X-User-Role matches allowedRoles passes",
			allowedRoles: []string{"admin", "super-admin"},
			setupReq: func() *http.Request {
				req := httptest.NewRequest("GET", "/admin", nil)
				req.Header.Set("X-User-Role", "admin")
				return req
			},
			wantStatus: fiber.StatusOK,
		},
		{
			name:         "X-User-Role does not match returns 403",
			allowedRoles: []string{"super-admin"},
			setupReq: func() *http.Request {
				req := httptest.NewRequest("GET", "/admin", nil)
				req.Header.Set("X-User-Role", "admin")
				return req
			},
			wantStatus: fiber.StatusForbidden,
		},
		{
			name:         "missing X-User-Role defaults to admin and fails if admin not allowed",
			allowedRoles: []string{"super-admin"},
			setupReq: func() *http.Request {
				return httptest.NewRequest("GET", "/admin", nil)
			},
			wantStatus: fiber.StatusForbidden,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			app := fiber.New()
			app.Get("/admin", RequireRoles(tt.allowedRoles...), func(c fiber.Ctx) error {
				return c.SendStatus(fiber.StatusOK)
			})

			resp, err := app.Test(tt.setupReq())
			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)
		})
	}
}
