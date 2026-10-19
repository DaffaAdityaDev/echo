package settings

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	httpxconst "echo-backend/internal/constants/httpx"
	"echo-backend/internal/constants/locals"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/config"

	"github.com/gofiber/fiber/v3"
)

type staticResolver struct {
	ip string
}

func (r staticResolver) LookupIPAddr(context.Context, string) ([]net.IPAddr, error) {
	return []net.IPAddr{{IP: net.ParseIP(r.ip)}}, nil
}

func putSettings(t *testing.T, h *Handler, body string) int {
	t.Helper()
	app := fiber.New(fiber.Config{ErrorHandler: handlerutil.ErrorHandler})
	app.Put("/settings", func(c fiber.Ctx) error {
		c.Locals(locals.UserID, "1")
		return h.HandleUpdateSettings(c)
	})
	req := httptest.NewRequest(http.MethodPut, "/settings", strings.NewReader(body))
	req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	return resp.StatusCode
}

func TestHandleUpdateSettings_RejectsUnsafeBaseURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		baseURL string
		ip      string
	}{
		{name: "metadata endpoint", baseURL: "http://169.254.169.254/latest", ip: "169.254.169.254"},
		{name: "hostname resolving to private network", baseURL: "https://internal.example/v1", ip: "10.0.0.5"},
		{name: "non http scheme", baseURL: "file:///etc/passwd", ip: "8.8.8.8"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			h := &Handler{Cfg: &cfgmodel.Config{AllowPrivateProviderURLs: false}, Resolver: staticResolver{ip: tt.ip}}

			status := putSettings(t, h, `{"provider_type":"openai","base_url":"`+tt.baseURL+`"}`)

			if status != fiber.StatusBadRequest {
				t.Fatalf("expected 400 for %s, got %d", tt.baseURL, status)
			}
		})
	}
}
