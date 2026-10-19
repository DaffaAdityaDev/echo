package session

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	httpxconst "echo-backend/internal/constants/httpx"
	"echo-backend/internal/models/config"
	"echo-backend/internal/service/consolidation"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func prunePost(t *testing.T, h *Handler, sessionID string) *http.Response {
	t.Helper()
	app := newTestApp(h, http.MethodPost, "/sessions/:id/prune", h.HandlePruneSession)
	req := httptest.NewRequest(http.MethodPost, "/sessions/"+sessionID+"/prune", strings.NewReader(`{"provider_config":{}}`))
	req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
	resp, err := app.Test(req)
	require.NoError(t, err)
	return resp
}

func TestHandlePruneSession_RejectsNonUUID(t *testing.T) {
	t.Parallel()

	svc := new(mockConsolidationSvc)
	h := &Handler{Cfg: &cfgmodel.Config{}, ConsolidationSvc: svc}

	resp := prunePost(t, h, "not-a-uuid")

	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	svc.AssertNotCalled(t, "TriggerConsolidation", mock.Anything, mock.Anything, mock.Anything)
}

func TestHandlePruneSession_MissingSessionReturns404(t *testing.T) {
	t.Parallel()

	svc := new(mockConsolidationSvc)
	svc.On("TriggerConsolidation", mock.Anything, sharedSessionID, mock.Anything).
		Return(fmt.Errorf("%w: %s", consolidation.ErrSessionNotFound, sharedSessionID))
	h := &Handler{Cfg: &cfgmodel.Config{}, ConsolidationSvc: svc}

	resp := prunePost(t, h, sharedSessionID)

	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}
