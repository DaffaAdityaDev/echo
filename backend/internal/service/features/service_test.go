package features

import (
	"context"
	"echo-backend/internal/models/config"
	featuresmodel "echo-backend/internal/models/features"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeRepo struct {
	active  []featuresmodel.Feature
	listErr error
}

func (f *fakeRepo) ListActive(ctx context.Context) ([]featuresmodel.Feature, error) {
	return f.active, f.listErr
}

func (f *fakeRepo) GetByID(ctx context.Context, id string) (*featuresmodel.Feature, error) {
	for _, feat := range f.active {
		if feat.ID == id {
			return &feat, nil
		}
	}
	return nil, nil
}

func activeFixture() []featuresmodel.Feature {
	return []featuresmodel.Feature{
		{ID: "delegate_task", Name: "Sub-Agent Delegation", Description: "Enables splitting complex objectives into sub-tasks.", TierRequirement: "pro"},
		{ID: "web_search", Name: "Web Search", Description: "Quick search for real-time weather, prices, and news facts.", TierRequirement: "free"},
		{ID: "write_todos", Name: "Task Planning & Execution Board", Description: "Updates task board list state.", TierRequirement: "free"},
	}
}

func implementedFixture() string {
	return `[
		{"id":"delegate_task","name":"Sub-Agent Delegation","description":"Enables splitting complex objectives into sub-tasks."},
		{"id":"web_search","name":"Web Search","description":"Quick search for real-time weather, prices, and news facts."},
		{"id":"write_todos","name":"Task Planning & Execution Board","description":"Updates task board list state."}
	]`
}

func newTestService(t *testing.T, repo FeatureRepository, handler http.HandlerFunc) (*Service, *httptest.Server) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	svc := NewService(&cfgmodel.Config{
		AgentHTTPURL:      server.URL,
		InternalAuthToken: "test-token",
	}, nil, repo)
	svc.httpClient = server.Client()
	return svc, server
}

func standardImplementedServer() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Internal-Token") != "test-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, implementedFixture())
	}
}

func TestValidateRequest_UnknownFeature(t *testing.T) {
	t.Parallel()

	svc, _ := newTestService(t, &fakeRepo{active: activeFixture()}, standardImplementedServer())

	err := svc.ValidateRequest(context.Background(), []string{"no_such_feature"}, "free")
	var unknown ErrUnknownFeature
	if !errors.As(err, &unknown) {
		t.Fatalf("Expected ErrUnknownFeature, got %v", err)
	}
	if unknown.ID != "no_such_feature" {
		t.Errorf("Expected unknown ID 'no_such_feature', got %q", unknown.ID)
	}
	if err.Error() != "Unknown feature 'no_such_feature'" {
		t.Errorf("Unexpected error message: %q", err.Error())
	}
}

func TestValidateRequest_ImplementedGapIsUnknown(t *testing.T) {
	t.Parallel()

	// delegate_task is active in the DB but missing from the agent's implemented set.
	partial := `[
		{"id":"web_search","name":"Web Search","description":"Quick search for real-time weather, prices, and news facts."},
		{"id":"write_todos","name":"Task Planning & Execution Board","description":"Updates task board list state."}
	]`
	svc, _ := newTestService(t, &fakeRepo{active: activeFixture()}, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, partial)
	})

	err := svc.ValidateRequest(context.Background(), []string{"delegate_task"}, "pro")
	var unknown ErrUnknownFeature
	if !errors.As(err, &unknown) {
		t.Fatalf("Expected ErrUnknownFeature for implemented-gap feature, got %v", err)
	}
	if unknown.ID != "delegate_task" {
		t.Errorf("Expected unknown ID 'delegate_task', got %q", unknown.ID)
	}
}

func TestValidateRequest_LockedForFreeUser(t *testing.T) {
	t.Parallel()

	svc, _ := newTestService(t, &fakeRepo{active: activeFixture()}, standardImplementedServer())

	err := svc.ValidateRequest(context.Background(), []string{"delegate_task"}, "free")
	var locked ErrFeatureLocked
	if !errors.As(err, &locked) {
		t.Fatalf("Expected ErrFeatureLocked, got %v", err)
	}
	if locked.Name != "Sub-Agent Delegation" {
		t.Errorf("Expected locked name 'Sub-Agent Delegation', got %q", locked.Name)
	}
	if err.Error() != "Feature 'Sub-Agent Delegation' requires a Pro subscription." {
		t.Errorf("Unexpected error message: %q", err.Error())
	}
}

func TestValidateRequest_FreeFeatureForFreeUserOK(t *testing.T) {
	t.Parallel()

	svc, _ := newTestService(t, &fakeRepo{active: activeFixture()}, standardImplementedServer())

	if err := svc.ValidateRequest(context.Background(), []string{"web_search", "write_todos"}, "free"); err != nil {
		t.Fatalf("Expected no error for free features, got %v", err)
	}
}

func TestValidateRequest_ProFeatureForProUserOK(t *testing.T) {
	t.Parallel()

	svc, _ := newTestService(t, &fakeRepo{active: activeFixture()}, standardImplementedServer())

	if err := svc.ValidateRequest(context.Background(), []string{"delegate_task", "web_search"}, "pro"); err != nil {
		t.Fatalf("Expected no error for pro user, got %v", err)
	}
}

func TestValidateRequest_EmptyFeaturesSkipped(t *testing.T) {
	t.Parallel()

	called := false
	svc, _ := newTestService(t, &fakeRepo{active: activeFixture()}, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusInternalServerError)
	})

	if err := svc.ValidateRequest(context.Background(), nil, "free"); err != nil {
		t.Fatalf("Expected no error for empty features, got %v", err)
	}
	if err := svc.ValidateRequest(context.Background(), []string{}, "free"); err != nil {
		t.Fatalf("Expected no error for empty features slice, got %v", err)
	}
	if called {
		t.Error("Expected no agent calls when no features requested")
	}
}

func TestValidateRequest_FailOpenWhenAgentUnreachable(t *testing.T) {
	t.Parallel()

	svc, _ := newTestService(t, &fakeRepo{active: activeFixture()}, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	if err := svc.ValidateRequest(context.Background(), []string{"delegate_task"}, "free"); err != nil {
		t.Fatalf("Expected fail-open (nil error) when agent is unreachable, got %v", err)
	}
}

func TestValidateRequest_FailOpenWhenRepoFails(t *testing.T) {
	t.Parallel()

	svc, _ := newTestService(t, &fakeRepo{active: nil, listErr: errors.New("db down")}, standardImplementedServer())

	if err := svc.ValidateRequest(context.Background(), []string{"delegate_task"}, "free"); err != nil {
		t.Fatalf("Expected fail-open (nil error) when repo fails, got %v", err)
	}
}

func TestResolvePublicCatalog_Intersection(t *testing.T) {
	t.Parallel()

	svc, _ := newTestService(t, &fakeRepo{active: activeFixture()}, standardImplementedServer())

	catalog, err := svc.ResolvePublicCatalog(context.Background(), "free")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if len(catalog) != 3 {
		t.Fatalf("Expected 3 features in catalog, got %d", len(catalog))
	}

	byID := map[string]FeatureResponse{}
	for _, f := range catalog {
		byID[f.ID] = f
	}

	if f := byID["delegate_task"]; !f.Locked {
		t.Error("Expected delegate_task locked for free user")
	}
	if f := byID["web_search"]; f.Locked {
		t.Error("Expected web_search unlocked for free user")
	}
	if f := byID["delegate_task"]; f.Name != "Sub-Agent Delegation" || f.Description == "" {
		t.Errorf("Expected DB name/description in catalog, got %+v", f)
	}
}

func TestResolvePublicCatalog_ProUserSeesNothingLocked(t *testing.T) {
	t.Parallel()

	svc, _ := newTestService(t, &fakeRepo{active: activeFixture()}, standardImplementedServer())

	catalog, err := svc.ResolvePublicCatalog(context.Background(), "pro")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	for _, f := range catalog {
		if f.Locked {
			t.Errorf("Expected no locked features for pro user, got %q locked", f.ID)
		}
	}
}

func TestResolvePublicCatalog_FiltersNonImplemented(t *testing.T) {
	t.Parallel()

	svc, _ := newTestService(t, &fakeRepo{active: activeFixture()}, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `[{"id":"web_search","name":"Web Search","description":"Quick search for real-time weather, prices, and news facts."}]`)
	})

	catalog, err := svc.ResolvePublicCatalog(context.Background(), "free")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if len(catalog) != 1 || catalog[0].ID != "web_search" {
		t.Fatalf("Expected only implemented features in catalog, got %+v", catalog)
	}
}

func TestResolvePublicCatalog_RepoError(t *testing.T) {
	t.Parallel()

	svc, _ := newTestService(t, &fakeRepo{active: nil, listErr: errors.New("db down")}, standardImplementedServer())

	if _, err := svc.ResolvePublicCatalog(context.Background(), "free"); err == nil {
		t.Fatal("Expected error when repo fails")
	}
}
