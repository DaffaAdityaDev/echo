package llmops

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	authconst "echo-backend/internal/constants/auth"
	domainconst "echo-backend/internal/constants/domain"
	"echo-backend/internal/middleware"
	"echo-backend/internal/models/config"
	llmopsmodel "echo-backend/internal/models/llmops"
	llmopsSvc "echo-backend/internal/service/llmops"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

type fakePromptService struct {
	llmopsSvc.PromptService
	active *llmopsmodel.PromptVersion
	err    error
}

func (f *fakePromptService) GetActivePrompt(ctx context.Context, tenantID, templateName string) (*llmopsmodel.PromptVersion, error) {
	return f.active, f.err
}

func signServiceJWT(t *testing.T, secret string) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "agent",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	tokenStr, err := token.SignedString([]byte(secret))
	assert.NoError(t, err)
	return tokenStr
}

func newAgentPromptTestApp(t *testing.T, svc llmopsSvc.PromptService) *fiber.App {
	t.Helper()
	cfg := &cfgmodel.Config{ServiceJWTSecret: "service-jwt-secret"}
	app := fiber.New()
	internalGroup := app.Group("/api/v1/internal", middleware.InternalAuthRequired(cfg))
	internalGroup.Get("/prompts/active", NewAgentPromptHandler(svc).HandleGetAgentActivePrompt)
	return app
}

func TestAgentGetActivePrompt_NoToken(t *testing.T) {
	t.Parallel()

	app := newAgentPromptTestApp(t, &fakePromptService{})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/internal/prompts/active?template=support", nil)

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
}

func TestAgentGetActivePrompt_MissingTemplate(t *testing.T) {
	t.Parallel()

	app := newAgentPromptTestApp(t, &fakePromptService{})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/internal/prompts/active", nil)
	req.Header.Set(authconst.HeaderAuthorization, authconst.BearerPrefix+signServiceJWT(t, "service-jwt-secret"))

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
}

func TestAgentGetActivePrompt_Success(t *testing.T) {
	t.Parallel()

	svc := &fakePromptService{
		active: &llmopsmodel.PromptVersion{
			ID:           "v-1",
			TemplateID:   "tpl-1",
			Version:      3,
			SystemPrompt: "You are a helpful support agent.",
			BoundTools:   []string{"web_search", "write_todos"},
			Variables:    []string{"{{user_name}}"},
			Status:       domainconst.Production,
		},
	}
	app := newAgentPromptTestApp(t, svc)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/internal/prompts/active?template=support", nil)
	req.Header.Set("X-Tenant-ID", "tenant-x")
	req.Header.Set(authconst.HeaderAuthorization, authconst.BearerPrefix+signServiceJWT(t, "service-jwt-secret"))

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	assert.NoError(t, err)
	assert.Contains(t, string(body), `"version":3`)
	assert.Contains(t, string(body), `"system_prompt":"You are a helpful support agent."`)
	assert.Contains(t, string(body), `"status":"`+domainconst.Production+`"`)
}

func TestAgentGetActivePrompt_NotFound(t *testing.T) {
	t.Parallel()

	svc := &fakePromptService{err: context.DeadlineExceeded}
	app := newAgentPromptTestApp(t, svc)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/internal/prompts/active?template=support", nil)
	req.Header.Set(authconst.HeaderAuthorization, authconst.BearerPrefix+signServiceJWT(t, "service-jwt-secret"))

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}
