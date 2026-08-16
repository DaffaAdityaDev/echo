package consolidation

import (
	"context"
	httpxconst "echo-backend/internal/constants/httpx"
	"echo-backend/internal/models/chat"
	"echo-backend/internal/models/config"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockSessionRepo struct {
	mock.Mock
}

func (m *mockSessionRepo) GetSessionTokenCount(ctx context.Context, sessionID string) (int, error) {
	args := m.Called(ctx, sessionID)
	return args.Int(0), args.Error(1)
}

func (m *mockSessionRepo) GetMaxTurnNumber(ctx context.Context, sessionID string) (int, error) {
	args := m.Called(ctx, sessionID)
	return args.Int(0), args.Error(1)
}

func (m *mockSessionRepo) GetSessionMessagesOldestFirst(ctx context.Context, sessionID string, limit int) ([]*chatmodel.Message, error) {
	args := m.Called(ctx, sessionID, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*chatmodel.Message), args.Error(1)
}

func (m *mockSessionRepo) GetByID(ctx context.Context, sessionID string) (*chatmodel.Session, error) {
	args := m.Called(ctx, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*chatmodel.Session), args.Error(1)
}

func (m *mockSessionRepo) PruneSession(ctx context.Context, sessionID string, newSummary string, pruneLimitTurn int) error {
	args := m.Called(ctx, sessionID, newSummary, pruneLimitTurn)
	return args.Error(0)
}

func TestCheckThreshold(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{PRUNE_THRESHOLD: 100}

	tests := []struct {
		name       string
		sessionID  string
		tokenCount int
		mockErr    error
		want       bool
		wantErr    bool
	}{
		{name: "token count exceeds threshold", sessionID: "sess_exceed", tokenCount: 150, want: true},
		{name: "token count equals threshold", sessionID: "sess_equal", tokenCount: 100, want: true},
		{name: "token count below threshold", sessionID: "sess_below", tokenCount: 50, want: false},
		{name: "repo returns error", sessionID: "sess_error", mockErr: assert.AnError, wantErr: true},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			mockRepo := new(mockSessionRepo)
			mockRepo.On("GetSessionTokenCount", mock.Anything, tt.sessionID).Return(tt.tokenCount, tt.mockErr)

			svc := &Service{
				cfg:         cfg,
				sessionRepo: mockRepo,
			}

			got, err := svc.CheckThreshold(context.Background(), tt.sessionID, nil)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
			assert.Equal(t, tt.want, got)
			mockRepo.AssertExpectations(t)
		})
	}
}

func TestCheckThreshold_SkipsAstronomicallyLargeSessions(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{
		PRUNE_THRESHOLD:         100,
		ConsolidationSkipTokens: 200000,
	}

	mockRepo := new(mockSessionRepo)
	// 1M-context stress session: far above the skip threshold.
	mockRepo.On("GetSessionTokenCount", mock.Anything, "sess_stress").Return(22_000_000, nil)

	svc := &Service{cfg: cfg, sessionRepo: mockRepo}
	got, err := svc.CheckThreshold(context.Background(), "sess_stress", nil)
	assert.NoError(t, err)
	assert.False(t, got, "consolidation must be skipped for sessions above the skip threshold")
	mockRepo.AssertExpectations(t)
}

func TestCheckThreshold_DerivesSkipThresholdFromContext(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{
		PRUNE_THRESHOLD:        100,
		ConsolidationSkipRatio: 90,
	}

	mockRepo := new(mockSessionRepo)
	mockRepo.On("GetSessionTokenCount", mock.Anything, "sess_huge").Return(22_000_000, nil)

	svc := &Service{cfg: cfg, sessionRepo: mockRepo}
	// 10M-token model → derived skip threshold = 9M → 22M session is skipped.
	got, err := svc.CheckThreshold(context.Background(), "sess_huge", map[string]interface{}{"max_context_tokens": 10_000_000})
	assert.NoError(t, err)
	assert.False(t, got, "session beyond the derived skip threshold must be skipped")

	// A 5M-token session fits the same 9M threshold → consolidation proceeds.
	mockRepo.On("GetSessionTokenCount", mock.Anything, "sess_big").Return(5_000_000, nil)
	got, err = svc.CheckThreshold(context.Background(), "sess_big", map[string]interface{}{"max_context_tokens": 10_000_000})
	assert.NoError(t, err)
	assert.True(t, got, "session within the derived skip threshold must not be skipped")
	mockRepo.AssertExpectations(t)
}

func TestCheckThreshold_SkipGuardDisabledWhenRatioZero(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{
		PRUNE_THRESHOLD:        100,
		ConsolidationSkipRatio: 0, // ratio 0 = guard disabled
	}

	mockRepo := new(mockSessionRepo)
	mockRepo.On("GetSessionTokenCount", mock.Anything, "sess_big").Return(22_000_000, nil)

	svc := &Service{cfg: cfg, sessionRepo: mockRepo}
	got, err := svc.CheckThreshold(context.Background(), "sess_big", map[string]interface{}{"max_context_tokens": 10_000_000})
	assert.NoError(t, err)
	assert.True(t, got, "skip ratio 0 should not block consolidation")
	mockRepo.AssertExpectations(t)
}

func TestTriggerConsolidation_FetchesOldestMessages(t *testing.T) {
	cfg := &cfgmodel.Config{
		PRUNE_KEEP_LATEST_TURNS: 10,
		SUMMARIZE_MAX_TOKENS:    2000,
		AgentHTTPURL:            "http://unused:8000",
		InternalAuthToken:       "secret",
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, httpxconst.ContentTypeJSON, r.Header.Get(httpxconst.HeaderContentType))
		assert.Equal(t, "secret", r.Header.Get(httpxconst.HeaderXInternalToken))
		w.Header().Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"summary":"sum","token_count":10,"messages_summarized":2}`))
	}))
	defer server.Close()
	cfg.AgentHTTPURL = server.URL

	// Oldest turns (<= pruneLimitTurn) must be returned by the oldest-first
	// loader — a newest-first cap would return only recent turns once the
	// session exceeds the cap, leaving messagesToSummarize empty.
	oldMessages := []*chatmodel.Message{
		{TurnNumber: 1, Role: "user", Content: "hello"},
		{TurnNumber: 1, Role: "assistant", Content: "hi"},
	}

	mockRepo := new(mockSessionRepo)
	mockRepo.On("GetSessionTokenCount", mock.Anything, "sess_x").Return(100, nil)
	mockRepo.On("GetMaxTurnNumber", mock.Anything, "sess_x").Return(30, nil)
	mockRepo.On("GetSessionMessagesOldestFirst", mock.Anything, "sess_x", 200).Return(oldMessages, nil)
	mockRepo.On("GetByID", mock.Anything, "sess_x").Return(&chatmodel.Session{ID: "sess_x"}, nil)
	mockRepo.On("PruneSession", mock.Anything, "sess_x", "sum", 20).Return(nil)

	svc := &Service{cfg: cfg, sessionRepo: mockRepo}
	err := svc.TriggerConsolidation(context.Background(), "sess_x", map[string]interface{}{})
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestTriggerConsolidation_SkipsAstronomicallyLargeSessions(t *testing.T) {
	cfg := &cfgmodel.Config{
		PRUNE_KEEP_LATEST_TURNS: 10,
		ConsolidationSkipTokens: 200000,
		AgentHTTPURL:            "http://must-not-be-hit:8000",
		InternalAuthToken:       "secret",
	}

	serverHit := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		serverHit = true
	}))
	defer server.Close()
	cfg.AgentHTTPURL = server.URL

	mockRepo := new(mockSessionRepo)
	// 1M-context stress session: far above the skip threshold. No other repo
	// call may happen — the guard must stop the attempt before any work.
	mockRepo.On("GetSessionTokenCount", mock.Anything, "sess_huge").Return(22_000_000, nil)

	svc := &Service{cfg: cfg, sessionRepo: mockRepo}
	// Explicit override (200k) wins over the context-derived threshold.
	err := svc.TriggerConsolidation(context.Background(), "sess_huge", map[string]interface{}{"max_context_tokens": 10_000_000})
	assert.NoError(t, err)
	assert.False(t, serverHit, "must not attempt to summarize sessions above the skip threshold")
	mockRepo.AssertExpectations(t)
}

func TestTriggerConsolidation_DerivesSkipThresholdFromContext(t *testing.T) {
	cfg := &cfgmodel.Config{
		PRUNE_KEEP_LATEST_TURNS: 10,
		ConsolidationSkipRatio:  90,
		AgentHTTPURL:            "http://must-not-be-hit:8000",
		InternalAuthToken:       "secret",
	}

	serverHit := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		serverHit = true
	}))
	defer server.Close()
	cfg.AgentHTTPURL = server.URL

	mockRepo := new(mockSessionRepo)
	// 10M-token model → derived skip threshold = 9M. A 22M session is skipped
	// before any work; only the token count may be queried.
	mockRepo.On("GetSessionTokenCount", mock.Anything, "sess_huge").Return(22_000_000, nil)

	svc := &Service{cfg: cfg, sessionRepo: mockRepo}
	err := svc.TriggerConsolidation(context.Background(), "sess_huge", map[string]interface{}{"max_context_tokens": 10_000_000})
	assert.NoError(t, err)
	assert.False(t, serverHit, "session beyond the derived skip threshold must not be summarized")
	mockRepo.AssertExpectations(t)
}

func TestTriggerConsolidation_SkipGuardDisabledWhenRatioZero(t *testing.T) {
	cfg := &cfgmodel.Config{
		PRUNE_KEEP_LATEST_TURNS: 10,
		ConsolidationSkipRatio:  0, // ratio 0 = guard disabled
		AgentHTTPURL:            "http://must-not-be-hit:8000",
		InternalAuthToken:       "secret",
	}

	mockRepo := new(mockSessionRepo)
	mockRepo.On("GetSessionTokenCount", mock.Anything, "sess_big").Return(22_000_000, nil)
	mockRepo.On("GetMaxTurnNumber", mock.Anything, "sess_big").Return(0, nil)

	svc := &Service{cfg: cfg, sessionRepo: mockRepo}
	err := svc.TriggerConsolidation(context.Background(), "sess_big", map[string]interface{}{"max_context_tokens": 10_000_000})
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestTriggerConsolidation_CapsGiantMessagesToTokenBudget(t *testing.T) {
	cfg := &cfgmodel.Config{
		PRUNE_KEEP_LATEST_TURNS: 10,
		SUMMARIZE_MAX_TOKENS:    2000,
		HistoryMaxTokens:        50000,
		HistoryMaxMsgChars:      100000,
		InternalAuthToken:       "secret",
	}

	var captured SummarizeRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&captured)
		w.Header().Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"summary":"sum","token_count":10,"messages_summarized":2}`))
	}))
	defer server.Close()
	cfg.AgentHTTPURL = server.URL

	giantContent := strings.Repeat("x", 1_000_000)
	oldMessages := []*chatmodel.Message{
		{TurnNumber: 1, Role: "user", Content: giantContent, TokenCount: 1_000_000},
		{TurnNumber: 2, Role: "assistant", Content: giantContent, TokenCount: 1_000_000},
	}

	mockRepo := new(mockSessionRepo)
	mockRepo.On("GetSessionTokenCount", mock.Anything, "sess_giant").Return(100, nil)
	mockRepo.On("GetMaxTurnNumber", mock.Anything, "sess_giant").Return(30, nil)
	mockRepo.On("GetSessionMessagesOldestFirst", mock.Anything, "sess_giant", 200).Return(oldMessages, nil)
	mockRepo.On("GetByID", mock.Anything, "sess_giant").Return(&chatmodel.Session{ID: "sess_giant"}, nil)
	mockRepo.On("PruneSession", mock.Anything, "sess_giant", "sum", 20).Return(nil)

	svc := &Service{cfg: cfg, sessionRepo: mockRepo}
	// HISTORY_MAX_TOKENS override (50k) wins over the context-derived budget.
	err := svc.TriggerConsolidation(context.Background(), "sess_giant", map[string]interface{}{"max_context_tokens": 10_000_000})
	assert.NoError(t, err)

	total := 0
	for _, m := range captured.Messages {
		total += len(m.Content) / 4
		assert.LessOrEqual(t, len(m.Content), 100000+len("\n...[truncated]"), "message content must be truncated")
	}
	assert.LessOrEqual(t, total, 50000, "summarize payload estimate must stay within the token budget")
	assert.NotEmpty(t, captured.Messages, "oldest messages must still be summarized after capping")
	mockRepo.AssertExpectations(t)
}

func TestTriggerConsolidation_DerivesBudgetFromContext(t *testing.T) {
	cfg := &cfgmodel.Config{
		PRUNE_KEEP_LATEST_TURNS: 10,
		SUMMARIZE_MAX_TOKENS:    2000,
		SummarizePayloadRatio:   60,
		InternalAuthToken:       "secret",
	}

	var captured SummarizeRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&captured)
		w.Header().Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"summary":"sum","token_count":10,"messages_summarized":2}`))
	}))
	defer server.Close()
	cfg.AgentHTTPURL = server.URL

	giantContent := strings.Repeat("x", 1_000_000)
	oldMessages := []*chatmodel.Message{
		{TurnNumber: 1, Role: "user", Content: giantContent, TokenCount: 1_000_000},
		{TurnNumber: 2, Role: "assistant", Content: giantContent, TokenCount: 1_000_000},
	}

	mockRepo := new(mockSessionRepo)
	mockRepo.On("GetSessionTokenCount", mock.Anything, "sess_10m").Return(100, nil)
	mockRepo.On("GetMaxTurnNumber", mock.Anything, "sess_10m").Return(30, nil)
	mockRepo.On("GetSessionMessagesOldestFirst", mock.Anything, "sess_10m", 200).Return(oldMessages, nil)
	mockRepo.On("GetByID", mock.Anything, "sess_10m").Return(&chatmodel.Session{ID: "sess_10m"}, nil)
	mockRepo.On("PruneSession", mock.Anything, "sess_10m", "sum", 20).Return(nil)

	svc := &Service{cfg: cfg, sessionRepo: mockRepo}
	// 10M-token model → derived budget = 6M tokens, per-message cap 12M chars:
	// two 1M-char messages fit entirely, untruncated.
	err := svc.TriggerConsolidation(context.Background(), "sess_10m", map[string]interface{}{"max_context_tokens": 10_000_000})
	assert.NoError(t, err)

	assert.Len(t, captured.Messages, 2, "giant messages must fit within the context-derived budget")
	for _, m := range captured.Messages {
		assert.Equal(t, giantContent, m.Content, "content must not be truncated within a 6M-token budget")
	}
	mockRepo.AssertExpectations(t)
}
