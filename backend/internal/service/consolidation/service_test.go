package consolidation

import (
	"context"
	"echo-backend/internal/models"
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

func (m *mockSessionRepo) GetSessionMessages(ctx context.Context, sessionID string) ([]*models.Message, error) {
	args := m.Called(ctx, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Message), args.Error(1)
}

func (m *mockSessionRepo) GetByID(ctx context.Context, sessionID string) (*models.Session, error) {
	args := m.Called(ctx, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Session), args.Error(1)
}

func (m *mockSessionRepo) PruneSession(ctx context.Context, sessionID string, newSummary string, pruneLimitTurn int) error {
	args := m.Called(ctx, sessionID, newSummary, pruneLimitTurn)
	return args.Error(0)
}

func TestCheckThreshold(t *testing.T) {
	t.Parallel()

	cfg := &models.Config{PRUNE_THRESHOLD: 100}

	tests := []struct {
		name      string
		sessionID string
		tokenCount int
		mockErr   error
		want      bool
		wantErr   bool
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
