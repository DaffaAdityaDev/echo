package middleware

import (
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
		userRole     string
		wantStatus   int
	}{
		{
			name:         "role in allowed list passes",
			allowedRoles: []string{"admin", "super-admin"},
			userRole:     "admin",
			wantStatus:   fiber.StatusOK,
		},
		{
			name:         "role not in allowed list returns 403",
			allowedRoles: []string{"super-admin"},
			userRole:     "admin",
			wantStatus:   fiber.StatusForbidden,
		},
		{
			name:         "missing role returns 403",
			allowedRoles: []string{"admin"},
			userRole:     "",
			wantStatus:   fiber.StatusForbidden,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			app := fiber.New()
			app.Get("/admin",
				func(c fiber.Ctx) error {
					if tt.userRole != "" {
						c.Locals("user_role", tt.userRole)
					}
					return c.Next()
				},
				RequireRoles(tt.allowedRoles...),
				func(c fiber.Ctx) error {
					return c.SendStatus(fiber.StatusOK)
				},
			)

			resp, err := app.Test(httptest.NewRequest("GET", "/admin", nil))
			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)
		})
	}
}
