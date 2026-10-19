package llmops

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	domainconst "echo-backend/internal/constants/domain"
	llmopsmodel "echo-backend/internal/models/llmops"
	llmopsSvc "echo-backend/internal/service/llmops"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
)

type studioPromptService struct {
	llmopsSvc.PromptService
	err          error
	gotTenantIDs []string
}

func (f *studioPromptService) CreatePromptTemplate(ctx context.Context, tenantID, name, desc string) (*llmopsmodel.PromptTemplate, error) {
	f.gotTenantIDs = append(f.gotTenantIDs, tenantID)
	return &llmopsmodel.PromptTemplate{TenantID: tenantID, Name: name}, f.err
}

func (f *studioPromptService) GetVersion(ctx context.Context, tenantID, templateID string, version int) (*llmopsmodel.PromptVersion, error) {
	f.gotTenantIDs = append(f.gotTenantIDs, tenantID)
	return nil, f.err
}

func (f *studioPromptService) PromoteToProduction(ctx context.Context, tenantID, templateID string, version int, actor string) error {
	f.gotTenantIDs = append(f.gotTenantIDs, tenantID)
	return f.err
}

func newStudioTestApp(svc llmopsSvc.PromptService) *fiber.App {
	h := NewPromptHandler(svc)
	app := fiber.New()
	app.Post("/prompts", h.HandleCreateTemplate)
	app.Get("/prompts/:id/versions/:v", h.HandleGetVersion)
	app.Post("/prompts/:id/promote/:version", h.HandlePromote)
	return app
}

func TestStudioIgnoresClientTenantHeader(t *testing.T) {
	t.Parallel()

	svc := &studioPromptService{}
	app := newStudioTestApp(svc)

	createReq := httptest.NewRequest(http.MethodPost, "/prompts", strings.NewReader(`{"name":"support"}`))
	createReq.Header.Set("Content-Type", "application/json")
	createReq.Header.Set("X-Tenant-ID", "victim-tenant")
	resp, err := app.Test(createReq)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)

	promoteReq := httptest.NewRequest(http.MethodPost, "/prompts/tpl-1/promote/2", nil)
	promoteReq.Header.Set("X-Tenant-ID", "victim-tenant")
	resp, err = app.Test(promoteReq)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	assert.Equal(t, []string{domainconst.DefaultTenantID, domainconst.DefaultTenantID}, svc.gotTenantIDs)
}

func TestStudioErrorStatusMapping(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		err    error
		method string
		path   string
		body   string
		want   int
	}{
		{"empty name", llmopsmodel.ErrTemplateNameRequired, http.MethodPost, "/prompts", `{"name":""}`, fiber.StatusBadRequest},
		{"duplicate name", llmopsmodel.ErrTemplateNameTaken, http.MethodPost, "/prompts", `{"name":"support"}`, fiber.StatusConflict},
		{"create store failure", errors.New("db down"), http.MethodPost, "/prompts", `{"name":"support"}`, fiber.StatusInternalServerError},
		{"missing version", llmopsmodel.ErrVersionNotFound, http.MethodGet, "/prompts/tpl-1/versions/9", "", fiber.StatusNotFound},
		{"foreign template", llmopsmodel.ErrTemplateNotFound, http.MethodGet, "/prompts/tpl-1/versions/1", "", fiber.StatusNotFound},
		{"promote missing version", llmopsmodel.ErrVersionNotFound, http.MethodPost, "/prompts/tpl-1/promote/9", "", fiber.StatusNotFound},
		{"promote rolled back", llmopsmodel.ErrVersionRolledBack, http.MethodPost, "/prompts/tpl-1/promote/2", "", fiber.StatusConflict},
		{"promote store failure", errors.New("db down"), http.MethodPost, "/prompts/tpl-1/promote/2", "", fiber.StatusInternalServerError},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			app := newStudioTestApp(&studioPromptService{err: tc.err})
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")

			resp, err := app.Test(req)
			assert.NoError(t, err)
			assert.Equal(t, tc.want, resp.StatusCode)
		})
	}
}

func TestStudioInternalErrorDoesNotLeakDetails(t *testing.T) {
	t.Parallel()

	app := newStudioTestApp(&studioPromptService{err: errors.New("pq: relation prompt_versions does not exist")})
	req := httptest.NewRequest(http.MethodPost, "/prompts/tpl-1/promote/2", nil)

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	assert.NoError(t, err)
	assert.NotContains(t, string(body), "prompt_versions")
}
