package consolidation

import (
	"context"
	"echo-backend/internal/models/chat"
	"echo-backend/internal/models/config"
	"net/http"
	"net/http/httptest"
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

			got, err := svc.CheckThreshold(context.Background(), tt.sessionID)
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
	got, err := svc.CheckThreshold(context.Background(), "sess_stress")
	assert.NoError(t, err)
	assert.False(t, got, "consolidation must be skipped for sessions above the skip threshold")
	mockRepo.AssertExpectations(t)
}

func TestCheckThreshold_SkipThresholdDisabledWhenZero(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{PRUNE_THRESHOLD: 100} // skip threshold 0 = disabled

	mockRepo := new(mockSessionRepo)
	mockRepo.On("GetSessionTokenCount", mock.Anything, "sess_big").Return(22_000_000, nil)

	svc := &Service{cfg: cfg, sessionRepo: mockRepo}
	got, err := svc.CheckThreshold(context.Background(), "sess_big")
	assert.NoError(t, err)
	assert.True(t, got, "skip threshold 0 should not block consolidation")
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
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
		assert.Equal(t, "secret", r.Header.Get("X-Internal-Token"))
		w.Header().Set("Content-Type", "application/json")
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
	mockRepo.On("GetMaxTurnNumber", mock.Anything, "sess_x").Return(30, nil)
	mockRepo.On("GetSessionMessagesOldestFirst", mock.Anything, "sess_x", 200).Return(oldMessages, nil)
	mockRepo.On("GetByID", mock.Anything, "sess_x").Return(&chatmodel.Session{ID: "sess_x"}, nil)
	mockRepo.On("PruneSession", mock.Anything, "sess_x", "sum", 20).Return(nil)

	svc := &Service{cfg: cfg, sessionRepo: mockRepo}
	err := svc.TriggerConsolidation(context.Background(), "sess_x", map[string]interface{}{})
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}
