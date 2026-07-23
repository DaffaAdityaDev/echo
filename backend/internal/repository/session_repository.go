package repository

import (
	"context"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/models"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SessionRepository struct {
	pool *pgxpool.Pool
}

func NewSessionRepository(pool *pgxpool.Pool) *SessionRepository {
	return &SessionRepository{pool: pool}
}

func (r *SessionRepository) CreateSession(ctx context.Context, userID int, title string) (*models.Session, error) {
	var s models.Session
	err := 	r.pool.QueryRow(ctx, db.QueryCreateSession, userID, title).
		Scan(&s.ID, &s.UserID, &s.Title, &s.ContextSummary, &s.Status, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}
	return &s, nil
}

func (r *SessionRepository) ListByUser(ctx context.Context, userID int) ([]*models.Session, error) {
	rows, err := 	r.pool.Query(ctx, db.QueryListSessions, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query sessions: %w", err)
	}
	defer rows.Close()

	var sessions []*models.Session
	for rows.Next() {
		var s models.Session
		err := rows.Scan(&s.ID, &s.UserID, &s.Title, &s.ContextSummary, &s.Status, &s.CreatedAt, &s.UpdatedAt, &s.MessageCount, &s.TokenCount)
		if err != nil {
			return nil, fmt.Errorf("failed to scan session row: %w", err)
		}
		sessions = append(sessions, &s)
	}
	return sessions, nil
}

func (r *SessionRepository) GetByID(ctx context.Context, sessionID string) (*models.Session, error) {
	var s models.Session
	err := 	r.pool.QueryRow(ctx, db.QueryGetSession, sessionID).
		Scan(&s.ID, &s.UserID, &s.Title, &s.ContextSummary, &s.Status, &s.CreatedAt, &s.UpdatedAt, &s.MessageCount, &s.TokenCount)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get session by id: %w", err)
	}
	return &s, nil
}

func (r *SessionRepository) DeleteSession(ctx context.Context, sessionID string) error {
	_, err := 	r.pool.Exec(ctx, db.QueryDeleteSession, sessionID)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}
	return nil
}

func (r *SessionRepository) UpdateContextSummary(ctx context.Context, sessionID string, summary string) error {
	_, err := 	r.pool.Exec(ctx, db.QueryUpdateContextSummary, sessionID, summary)
	if err != nil {
		return fmt.Errorf("failed to update context summary: %w", err)
	}
	return nil
}

func (r *SessionRepository) UpdateTitleAndSummary(ctx context.Context, sessionID string, title string, summary string) error {
	_, err := r.pool.Exec(ctx, db.QueryUpdateSessionTitleAndSummary, sessionID, title, summary)
	if err != nil {
		return fmt.Errorf("failed to update session title and summary: %w", err)
	}
	return nil
}

func (r *SessionRepository) GetSessionMessages(ctx context.Context, sessionID string) ([]*models.Message, error) {
	rows, err := 	r.pool.Query(ctx, db.QueryGetSessionMessages, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	var messages []*models.Message
	for rows.Next() {
		var m models.Message
		var stepsBytes []byte
		err := rows.Scan(&m.ID, &m.SessionID, &m.Role, &m.Content, &m.TokenCount, &m.TurnNumber, &stepsBytes, &m.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message row: %w", err)
		}
		if len(stepsBytes) > 0 && string(stepsBytes) != "null" {
			m.Steps = json.RawMessage(stepsBytes)
		}
		messages = append(messages, &m)
	}
	return messages, nil
}

func (r *SessionRepository) GetSessionTokenCount(ctx context.Context, sessionID string) (int, error) {
	var count int
	err := 	r.pool.QueryRow(ctx, db.QueryGetSessionTokenCount, sessionID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get token count: %w", err)
	}
	return count, nil
}

func (r *SessionRepository) GetMaxTurnNumber(ctx context.Context, sessionID string) (int, error) {
	var turn int
	err := 	r.pool.QueryRow(ctx, db.QueryGetMaxTurnNumber, sessionID).Scan(&turn)
	if err != nil {
		return 0, fmt.Errorf("failed to get max turn number: %w", err)
	}
	return turn, nil
}

func (r *SessionRepository) DeleteMessagesUpToTurn(ctx context.Context, sessionID string, maxTurn int) error {
	_, err := 	r.pool.Exec(ctx, db.QueryDeleteMessagesUpToTurn, sessionID, maxTurn)
	if err != nil {
		return fmt.Errorf("failed to delete messages: %w", err)
	}
	return nil
}

func stepsOrNull(m *models.Message) json.RawMessage {
	if len(m.Steps) > 0 {
		return m.Steps
	}
	return json.RawMessage("null")
}

func (r *SessionRepository) SaveTurnMessages(ctx context.Context, sessionID string, userMsg *models.Message, assistantMsg *models.Message, toolResults []*models.Message) error {
	tx, err := 	r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Insert user message
	_, err = tx.Exec(ctx, db.QueryInsertMessage, sessionID, userMsg.Role, userMsg.Content, userMsg.TokenCount, userMsg.TurnNumber, stepsOrNull(userMsg))
	if err != nil {
		return fmt.Errorf("failed to insert user message: %w", err)
	}

	// 2. Insert assistant message
	_, err = tx.Exec(ctx, db.QueryInsertMessage, sessionID, assistantMsg.Role, assistantMsg.Content, assistantMsg.TokenCount, assistantMsg.TurnNumber, stepsOrNull(assistantMsg))
	if err != nil {
		return fmt.Errorf("failed to insert assistant message: %w", err)
	}

	// 3. Insert tool results
	for _, tr := range toolResults {
		_, err = tx.Exec(ctx, db.QueryInsertMessage, sessionID, tr.Role, tr.Content, tr.TokenCount, tr.TurnNumber, stepsOrNull(tr))
		if err != nil {
			return fmt.Errorf("failed to insert tool result message: %w", err)
		}
	}

	// 4. Update session updated_at
	_, err = tx.Exec(ctx, db.QueryUpdateSessionUpdatedAt, sessionID)
	if err != nil {
		return fmt.Errorf("failed to update session timestamp: %w", err)
	}

	return tx.Commit(ctx)
}
