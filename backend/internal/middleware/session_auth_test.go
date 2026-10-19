package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"echo-backend/internal/constants/locals"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
)

func TestRequireSessionAuth(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		apiKeyID   string
		wantStatus int
	}{
		{name: "JWT session passes", wantStatus: fiber.StatusOK},
		{name: "API key auth returns 403", apiKeyID: "key_1", wantStatus: fiber.StatusForbidden},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			app := fiber.New()
			app.Post("/api-keys",
				func(c fiber.Ctx) error {
					if tt.apiKeyID != "" {
						c.Locals(locals.APIKeyID, tt.apiKeyID)
					}
					return c.Next()
				},
				RequireSessionAuth(),
				func(c fiber.Ctx) error {
					return c.SendStatus(fiber.StatusOK)
				},
			)

			resp, err := app.Test(httptest.NewRequest(http.MethodPost, "/api-keys", nil))
			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)
		})
	}
}
