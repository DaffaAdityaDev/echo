package llmops

import (
	"context"
	"errors"
	"sync"
	"testing"

	llmopsmodel "echo-backend/internal/models/llmops"
	propsrepo "echo-backend/internal/repository/llmops/module/props"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
)

type fakePromptRepo struct {
	propsrepo.Repository
	template    *llmopsmodel.PromptTemplate
	templateErr error
	promoteErr  error
	rollbackErr error
}

func (f *fakePromptRepo) PromoteVersion(ctx context.Context, templateID string, version int, actor string) error {
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

	err := svc.PromoteToProduction(context.Background(), "tpl-1", 2, "tester")
	assert.NoError(t, err)
}

func TestPromoteToProduction_InvalidatesCache(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{template: &llmopsmodel.PromptTemplate{TenantID: "tenant-x", Name: "support:v2"}}
	hook := &recordingRedisHook{}
	svc := NewPromptService(repo, newRecordingClient(hook))

	err := svc.PromoteToProduction(context.Background(), "tpl-1", 2, "tester")
	assert.NoError(t, err)

	hook.mu.Lock()
	defer hook.mu.Unlock()
	assert.Equal(t, [][]interface{}{{"del", "agent:prompts:tenant-x:support:v2"}}, hook.records)
}

func TestPromoteToProduction_TemplateLookupFailureIsSwallowed(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{templateErr: errors.New("db down")}
	hook := &recordingRedisHook{}
	svc := NewPromptService(repo, newRecordingClient(hook))

	err := svc.PromoteToProduction(context.Background(), "tpl-1", 2, "tester")
	assert.NoError(t, err)

	hook.mu.Lock()
	defer hook.mu.Unlock()
	assert.Empty(t, hook.records)
}

func TestPromoteToProduction_MissingTemplateSkipsInvalidation(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{}
	hook := &recordingRedisHook{}
	svc := NewPromptService(repo, newRecordingClient(hook))

	err := svc.PromoteToProduction(context.Background(), "tpl-1", 2, "tester")
	assert.NoError(t, err)

	hook.mu.Lock()
	defer hook.mu.Unlock()
	assert.Empty(t, hook.records)
}

func TestPromoteToProduction_RepoErrorPropagates(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{promoteErr: errors.New("promote failed")}
	svc := NewPromptService(repo, nil)

	err := svc.PromoteToProduction(context.Background(), "tpl-1", 2, "tester")
	assert.Error(t, err)
}

func TestRollbackToVersion_InvalidatesCache(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{template: &llmopsmodel.PromptTemplate{TenantID: "tenant-x", Name: "support:v2"}}
	hook := &recordingRedisHook{}
	svc := NewPromptService(repo, newRecordingClient(hook))

	err := svc.RollbackToVersion(context.Background(), "tpl-1", 1, "tester")
	assert.NoError(t, err)

	hook.mu.Lock()
	defer hook.mu.Unlock()
	assert.Equal(t, [][]interface{}{{"del", "agent:prompts:tenant-x:support:v2"}}, hook.records)
}

func TestRollbackToVersion_RepoErrorPropagates(t *testing.T) {
	t.Parallel()

	repo := &fakePromptRepo{rollbackErr: errors.New("rollback failed")}
	svc := NewPromptService(repo, nil)

	err := svc.RollbackToVersion(context.Background(), "tpl-1", 1, "tester")
	assert.Error(t, err)
}
