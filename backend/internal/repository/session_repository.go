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

func (r *SessionRepository) UpdateSessionTimestamp(ctx context.Context, sessionID string) error {
	_, err := r.pool.Exec(ctx, db.QueryUpdateSessionUpdatedAt, sessionID)
	if err != nil {
		return fmt.Errorf("failed to update session timestamp: %w", err)
	}
	return nil
}

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
		err := rows.Scan(&m.ID, &m.SessionID, &m.Role, &m.Content, &m.TokenCount, &m.TurnNumber, &stepsBytes, &m.Status, &m.CreatedAt)
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

func (r *SessionRepository) InsertMessage(ctx context.Context, sessionID, role, content string, tokenCount, turnNumber int, status string) (int64, error) {
	var id int64
	err := r.pool.QueryRow(ctx, db.QueryInsertMessageWithStatus, sessionID, role, content, tokenCount, turnNumber, status).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("failed to insert message: %w", err)
	}
	return id, nil
}

func (r *SessionRepository) InsertAssistantPlaceholder(ctx context.Context, sessionID string, turnNumber int) (int64, error) {
	var id int64
	err := r.pool.QueryRow(ctx, db.QueryInsertAssistantPlaceholder, sessionID, turnNumber).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("failed to insert assistant placeholder: %w", err)
	}
	return id, nil
}

func (r *SessionRepository) UpdateMessageContent(ctx context.Context, msgID int64, content string, steps json.RawMessage, tokenCount int) error {
	if steps == nil {
		steps = json.RawMessage("null")
	}
	_, err := r.pool.Exec(ctx, db.QueryUpdateMessageContent, msgID, content, steps, tokenCount)
	if err != nil {
		return fmt.Errorf("failed to update message content: %w", err)
	}
	return nil
}

func (r *SessionRepository) UpdateMessageStatus(ctx context.Context, msgID int64, status string) error {
	_, err := r.pool.Exec(ctx, db.QueryUpdateMessageStatus, msgID, status)
	if err != nil {
		return fmt.Errorf("failed to update message status: %w", err)
	}
	return nil
}

func (r *SessionRepository) MarkStreamingAsInterrupted(ctx context.Context, sessionID string) error {
	_, err := r.pool.Exec(ctx, db.QueryMarkSessionStreamingInterrupted, sessionID)
	if err != nil {
		return fmt.Errorf("failed to mark streaming messages as interrupted: %w", err)
	}
	return nil
}

// PrepareTurn executes MarkStreamingAsInterrupted + InsertUserMessage + InsertAssistantPlaceholder in a single ACID transaction.
func (r *SessionRepository) PrepareTurn(ctx context.Context, sessionID string, userContent string, userTokenCount, turnNumber int) (int64, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Mark existing streaming messages as interrupted
	_, err = tx.Exec(ctx, db.QueryMarkSessionStreamingInterrupted, sessionID)
	if err != nil {
		return 0, fmt.Errorf("failed to mark streaming as interrupted: %w", err)
	}

	// 2. Insert user message (status='complete')
	_, err = tx.Exec(ctx, db.QueryInsertMessageWithStatus, sessionID, "user", userContent, userTokenCount, turnNumber, "complete")
	if err != nil {
		return 0, fmt.Errorf("failed to insert user message: %w", err)
	}

	// 3. Insert assistant placeholder (status='streaming')
	var assistantMsgID int64
	err = tx.QueryRow(ctx, db.QueryInsertAssistantPlaceholder, sessionID, turnNumber).Scan(&assistantMsgID)
	if err != nil {
		return 0, fmt.Errorf("failed to insert assistant placeholder: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("failed to commit prepare turn tx: %w", err)
	}

	return assistantMsgID, nil
}

// CompleteTurn executes UpdateMessageContent + UpdateMessageStatus + UpdateSessionTimestamp in a single ACID transaction.
func (r *SessionRepository) CompleteTurn(ctx context.Context, assistantMsgID int64, sessionID string, content string, steps json.RawMessage, tokenCount int, status string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if steps == nil {
		steps = json.RawMessage("null")
	}

	if assistantMsgID > 0 {
		// 1. Update message content and steps
		_, err = tx.Exec(ctx, db.QueryUpdateMessageContent, assistantMsgID, content, steps, tokenCount)
		if err != nil {
			return fmt.Errorf("failed to update message content: %w", err)
		}

		// 2. Update message status
		_, err = tx.Exec(ctx, db.QueryUpdateMessageStatus, assistantMsgID, status)
		if err != nil {
			return fmt.Errorf("failed to update message status: %w", err)
		}
	}

	// 3. Update session timestamp
	_, err = tx.Exec(ctx, db.QueryUpdateSessionUpdatedAt, sessionID)
	if err != nil {
		return fmt.Errorf("failed to update session timestamp: %w", err)
	}

	return tx.Commit(ctx)
}

// PruneSession executes UpdateContextSummary + DeleteMessagesUpToTurn + UpdateSessionTimestamp in a single ACID transaction.
func (r *SessionRepository) PruneSession(ctx context.Context, sessionID string, newSummary string, pruneLimitTurn int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Update context summary
	_, err = tx.Exec(ctx, db.QueryUpdateContextSummary, sessionID, newSummary)
	if err != nil {
		return fmt.Errorf("failed to update context summary: %w", err)
	}

	// 2. Delete messages up to turn
	_, err = tx.Exec(ctx, db.QueryDeleteMessagesUpToTurn, sessionID, pruneLimitTurn)
	if err != nil {
		return fmt.Errorf("failed to delete messages up to turn: %w", err)
	}

	// 3. Update session timestamp
	_, err = tx.Exec(ctx, db.QueryUpdateSessionUpdatedAt, sessionID)
	if err != nil {
		return fmt.Errorf("failed to update session timestamp: %w", err)
	}

	return tx.Commit(ctx)
}
