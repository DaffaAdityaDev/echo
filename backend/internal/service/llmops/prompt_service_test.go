package llmops

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"

	llmopsmodel "echo-backend/internal/models/llmops"
	propsrepo "echo-backend/internal/repository/llmops/module/props"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
)

type fakePromptRepo struct {
	propsrepo.Repository
	template    *llmopsmodel.PromptTemplate
	templateErr error
	promoteErr  error
	rollbackErr error
	createErr   error
	active      *llmopsmodel.PromptVersion
	promoted    bool
}

func (f *fakePromptRepo) CreateTemplate(ctx context.Context, tenantID, name, desc string) (*llmopsmodel.PromptTemplate, error) {
	if f.createErr != nil {
		return nil, f.createErr
	}
	return &llmopsmodel.PromptTemplate{TenantID: tenantID, Name: name}, nil
}

func (f *fakePromptRepo) GetActiveVersionByName(ctx context.Context, tenantID, name string) (*llmopsmodel.PromptVersion, error) {
	return f.active, nil
}

func (f *fakePromptRepo) ListVersions(ctx context.Context, templateID string) ([]llmopsmodel.PromptVersion, error) {
	return nil, nil
}

func (f *fakePromptRepo) PromoteVersion(ctx context.Context, templateID string, version int, actor string) error {
	f.promoted = true
	return f.promoteErr
}

func (f *fakePromptRepo) RollbackVersion(ctx context.Context, templateID string, targetVersion int, actor string) error {
	return f.rollbackErr
}

func (f *fakePromptRepo) GetTemplateByID(ctx context.Context, templateID string) (*llmopsmodel.PromptTemplate, error) {
	return f.template, f.templateErr
}

type recordingRedisHook struct {
	mu      sync.Mutex
	records [][]interface{}
}

func (h *recordingRedisHook) DialHook(next redis.DialHook) redis.DialHook { return next }

func (h *recordingRedisHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		h.mu.Lock()
		h.records = append(h.records, cmd.Args())
		h.mu.Unlock()
		return nil
	}
}

func (h *recordingRedisHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}

func newRecordingClient(h *recordingRedisHook) *redis.Client {
	rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:1"})
	rdb.AddHook(h)
	return rdb
}

func TestPromptCacheKey(t *testing.T) {
	t.Parallel()
	assert.Equal(t, "agent:prompts:tenant-x:support:v2", promptCacheKey("tenant-x", "support:v2"))
}

func TestPromoteToProduction_NilRDBDoesNotPanic(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{template: &llmopsmodel.PromptTemplate{TenantID: "local", Name: "default-template"}}
	svc := NewPromptService(repo, nil)

	err := svc.PromoteToProduction(context.Background(), "local", "tpl-1", 2, "tester")
	assert.NoError(t, err)
}

func TestPromoteToProduction_InvalidatesCache(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{template: &llmopsmodel.PromptTemplate{TenantID: "tenant-x", Name: "support:v2"}}
	hook := &recordingRedisHook{}
	svc := NewPromptService(repo, newRecordingClient(hook))

	err := svc.PromoteToProduction(context.Background(), "tenant-x", "tpl-1", 2, "tester")
	assert.NoError(t, err)

	hook.mu.Lock()
	defer hook.mu.Unlock()
	assert.Equal(t, [][]interface{}{{"del", "agent:prompts:tenant-x:support:v2"}}, hook.records)
}

func TestPromoteToProduction_TemplateLookupFailureFailsClosed(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{templateErr: errors.New("db down")}
	svc := NewPromptService(repo, nil)

	err := svc.PromoteToProduction(context.Background(), "local", "tpl-1", 2, "tester")
	assert.ErrorContains(t, err, "db down")
	assert.False(t, repo.promoted)
}

func TestPromoteToProduction_MissingTemplateIsNotFound(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{}
	svc := NewPromptService(repo, nil)

	err := svc.PromoteToProduction(context.Background(), "local", "tpl-1", 2, "tester")
	assert.ErrorIs(t, err, llmopsmodel.ErrTemplateNotFound)
	assert.False(t, repo.promoted)
}

func TestTemplateOwnedByAnotherTenantIsNotFound(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{template: &llmopsmodel.PromptTemplate{TenantID: "tenant-a", Name: "support"}}
	svc := NewPromptService(repo, nil)
	ctx := context.Background()

	assert.ErrorIs(t, svc.PromoteToProduction(ctx, "tenant-b", "tpl-1", 2, "tester"), llmopsmodel.ErrTemplateNotFound)
	assert.ErrorIs(t, svc.RollbackToVersion(ctx, "tenant-b", "tpl-1", 1, "tester"), llmopsmodel.ErrTemplateNotFound)
	_, err := svc.GetVersion(ctx, "tenant-b", "tpl-1", 1)
	assert.ErrorIs(t, err, llmopsmodel.ErrTemplateNotFound)
	_, err = svc.GetVersionHistory(ctx, "tenant-b", "tpl-1")
	assert.ErrorIs(t, err, llmopsmodel.ErrTemplateNotFound)
	_, err = svc.CreateNewVersion(ctx, "tenant-b", "tpl-1", "prompt", "tester", nil, nil)
	assert.ErrorIs(t, err, llmopsmodel.ErrTemplateNotFound)
	assert.False(t, repo.promoted)
}

func TestPromoteToProduction_RepoErrorPropagates(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{
		template:   &llmopsmodel.PromptTemplate{TenantID: "local"},
		promoteErr: llmopsmodel.ErrVersionRolledBack,
	}
	svc := NewPromptService(repo, nil)

	err := svc.PromoteToProduction(context.Background(), "local", "tpl-1", 6, "tester")
	assert.ErrorIs(t, err, llmopsmodel.ErrVersionRolledBack)
}

func TestRollbackToVersion_InvalidatesCache(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{template: &llmopsmodel.PromptTemplate{TenantID: "tenant-x", Name: "support:v2"}}
	hook := &recordingRedisHook{}
	svc := NewPromptService(repo, newRecordingClient(hook))

	err := svc.RollbackToVersion(context.Background(), "tenant-x", "tpl-1", 1, "tester")
	assert.NoError(t, err)

	hook.mu.Lock()
	defer hook.mu.Unlock()
	assert.Equal(t, [][]interface{}{{"del", "agent:prompts:tenant-x:support:v2"}}, hook.records)
}

func TestRollbackToVersion_RepoErrorPropagates(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{
		template:    &llmopsmodel.PromptTemplate{TenantID: "local"},
		rollbackErr: errors.New("rollback failed"),
	}
	svc := NewPromptService(repo, nil)

	err := svc.RollbackToVersion(context.Background(), "local", "tpl-1", 1, "tester")
	assert.Error(t, err)
}

func TestCreatePromptTemplate_EmptyNameRejected(t *testing.T) {
	t.Parallel()

	svc := NewPromptService(&fakePromptRepo{}, nil)

	_, err := svc.CreatePromptTemplate(context.Background(), "local", "   ", "desc")
	assert.ErrorIs(t, err, llmopsmodel.ErrTemplateNameRequired)
}

func TestCreatePromptTemplate_DuplicateNameIsConflict(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{createErr: fmt.Errorf("create template: %w", &pgconn.PgError{Code: "23505"})}
	svc := NewPromptService(repo, nil)

	_, err := svc.CreatePromptTemplate(context.Background(), "local", "support", "desc")
	assert.ErrorIs(t, err, llmopsmodel.ErrTemplateNameTaken)
}

func TestGetActivePrompt_NoProductionVersionIsNotFound(t *testing.T) {
	t.Parallel()

	svc := NewPromptService(&fakePromptRepo{}, nil)

	_, err := svc.GetActivePrompt(context.Background(), "local", "support")
	assert.ErrorIs(t, err, llmopsmodel.ErrVersionNotFound)
}
