package session

import (
	"context"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/models/chat"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) CreateSession(ctx context.Context, userID int, title string, strategyVersion string) (*chatmodel.Session, error) {
	var s chatmodel.Session
	err := r.pool.QueryRow(ctx, db.QueryCreateSession, userID, title, strategyVersion).
		Scan(&s.ID, &s.UserID, &s.Title, &s.ContextSummary, &s.Status, &s.StrategyVersion, &s.LastAccessedAt, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}
	return &s, nil
}

func (r *Repository) ListByUser(ctx context.Context, userID int, limit int, offset int) ([]*chatmodel.Session, error) {
	rows, err := r.pool.Query(ctx, db.QueryListSessions, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query sessions: %w", err)
	}
	defer rows.Close()

	var sessions []*chatmodel.Session
	for rows.Next() {
		var s chatmodel.Session
		err := rows.Scan(&s.ID, &s.UserID, &s.Title, &s.ContextSummary, &s.Status, &s.StrategyVersion, &s.LastAccessedAt, &s.CreatedAt, &s.UpdatedAt, &s.MessageCount, &s.TokenCount)
		if err != nil {
			return nil, fmt.Errorf("failed to scan session row: %w", err)
		}
		sessions = append(sessions, &s)
	}
	return sessions, nil
}

func (r *Repository) GetByID(ctx context.Context, sessionID string) (*chatmodel.Session, error) {
	var s chatmodel.Session
	err := r.pool.QueryRow(ctx, db.QueryGetSession, sessionID).
		Scan(&s.ID, &s.UserID, &s.Title, &s.ContextSummary, &s.Status, &s.StrategyVersion, &s.LastAccessedAt, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get session by id: %w", err)
	}
	return &s, nil
}

func (r *Repository) PinStrategyVersion(ctx context.Context, sessionID string, version string) error {
	_, err := r.pool.Exec(ctx, db.QueryPinSessionStrategyVersion, sessionID, version)
	if err != nil {
		return fmt.Errorf("failed to pin strategy version: %w", err)
	}
	return nil
}

func (r *Repository) TouchSession(ctx context.Context, sessionID string) error {
	_, err := r.pool.Exec(ctx, db.QueryTouchSession, sessionID)
	if err != nil {
		return fmt.Errorf("failed to touch session: %w", err)
	}
	return nil
}

func (r *Repository) DeleteSession(ctx context.Context, sessionID string) error {
	_, err := r.pool.Exec(ctx, db.QueryDeleteSession, sessionID)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}
	return nil
}

func (r *Repository) UpdateTitleAndSummary(ctx context.Context, sessionID string, title string, summary string) error {
	_, err := r.pool.Exec(ctx, db.QueryUpdateSessionTitleAndSummary, sessionID, title, summary)
	if err != nil {
		return fmt.Errorf("failed to update session title and summary: %w", err)
	}
	return nil
}

func (r *Repository) GetSessionMessages(ctx context.Context, sessionID string, limit int, offset int) ([]*chatmodel.Message, error) {
	rows, err := r.pool.Query(ctx, db.QueryGetSessionMessages, sessionID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	var messages []*chatmodel.Message
	for rows.Next() {
		var m chatmodel.Message
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

// GetSessionMessagesOldestFirst returns the oldest messages in a session,
// capped by limit. Used by consolidation, which summarizes the oldest turns.
func (r *Repository) GetSessionMessagesOldestFirst(ctx context.Context, sessionID string, limit int) ([]*chatmodel.Message, error) {
	rows, err := r.pool.Query(ctx, db.QueryGetSessionMessagesAscending, sessionID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query oldest messages: %w", err)
	}
	defer rows.Close()

	var messages []*chatmodel.Message
	for rows.Next() {
		var m chatmodel.Message
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

func (r *Repository) GetSessionTokenCount(ctx context.Context, sessionID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, db.QueryGetSessionTokenCount, sessionID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get token count: %w", err)
	}
	return count, nil
}

func (r *Repository) GetMaxTurnNumber(ctx context.Context, sessionID string) (int, error) {
	var turn int
	err := r.pool.QueryRow(ctx, db.QueryGetMaxTurnNumber, sessionID).Scan(&turn)
	if err != nil {
		return 0, fmt.Errorf("failed to get max turn number: %w", err)
	}
	return turn, nil
}

func (r *Repository) DeleteMessagesUpToTurn(ctx context.Context, sessionID string, maxTurn int) error {
	_, err := r.pool.Exec(ctx, db.QueryDeleteMessagesUpToTurn, sessionID, maxTurn)
	if err != nil {
		return fmt.Errorf("failed to delete messages: %w", err)
	}
	return nil
}

func (r *Repository) UpdateMessageContent(ctx context.Context, msgID int64, content string, steps json.RawMessage, tokenCount int) error {
	if steps == nil {
		steps = json.RawMessage("null")
	}
	_, err := r.pool.Exec(ctx, db.QueryUpdateMessageContent, msgID, content, steps, tokenCount)
	if err != nil {
		return fmt.Errorf("failed to update message content: %w", err)
	}
	return nil
}

func (r *Repository) PrepareTurn(ctx context.Context, sessionID string, userContent string, userTokenCount, turnNumber int) (int64, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op if committed

	_, err = tx.Exec(ctx, db.QueryMarkSessionStreamingInterrupted, sessionID)
	if err != nil {
		return 0, fmt.Errorf("failed to mark streaming as interrupted: %w", err)
	}

	_, err = tx.Exec(ctx, db.QueryInsertMessageWithStatus, sessionID, "user", userContent, userTokenCount, turnNumber, "complete")
	if err != nil {
		return 0, fmt.Errorf("failed to insert user message: %w", err)
	}

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

func (r *Repository) CompleteTurn(ctx context.Context, assistantMsgID int64, sessionID string, content string, steps json.RawMessage, tokenCount int, status string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op if committed

	if steps == nil {
		steps = json.RawMessage("null")
	}

	if assistantMsgID > 0 {
		_, err = tx.Exec(ctx, db.QueryUpdateMessageContent, assistantMsgID, content, steps, tokenCount)
		if err != nil {
			return fmt.Errorf("failed to update message content: %w", err)
		}

		_, err = tx.Exec(ctx, db.QueryUpdateMessageStatus, assistantMsgID, status)
		if err != nil {
			return fmt.Errorf("failed to update message status: %w", err)
		}
	}

	_, err = tx.Exec(ctx, db.QueryUpdateSessionUpdatedAt, sessionID)
	if err != nil {
		return fmt.Errorf("failed to update session timestamp: %w", err)
	}

	return tx.Commit(ctx)
}

func (r *Repository) PruneSession(ctx context.Context, sessionID string, newSummary string, pruneLimitTurn int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op if committed

	_, err = tx.Exec(ctx, db.QueryUpdateContextSummary, sessionID, newSummary)
	if err != nil {
		return fmt.Errorf("failed to update context summary: %w", err)
	}

	_, err = tx.Exec(ctx, db.QueryDeleteMessagesUpToTurn, sessionID, pruneLimitTurn)
	if err != nil {
		return fmt.Errorf("failed to delete messages up to turn: %w", err)
	}

	_, err = tx.Exec(ctx, db.QueryUpdateSessionUpdatedAt, sessionID)
	if err != nil {
		return fmt.Errorf("failed to update session timestamp: %w", err)
	}

	return tx.Commit(ctx)
}

func (r *Repository) ScanSessionsForConsolidation(ctx context.Context, idleBefore time.Time, minTokenCount int, limit int) ([]*chatmodel.Session, error) {
	rows, err := r.pool.Query(ctx, db.QueryScanSessionsForConsolidation, idleBefore, minTokenCount, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to scan sessions for consolidation: %w", err)
	}
	defer rows.Close()

	var sessions []*chatmodel.Session
	for rows.Next() {
		var s chatmodel.Session
		err := rows.Scan(&s.ID, &s.UserID, &s.TokenCount)
		if err != nil {
			return nil, fmt.Errorf("failed to scan consolidation session row: %w", err)
		}
		sessions = append(sessions, &s)
	}
	return sessions, nil
}

func (r *Repository) ScanSessionsForArchive(ctx context.Context, inactiveBefore time.Time) ([]string, error) {
	rows, err := r.pool.Query(ctx, db.QueryScanSessionsForArchive, inactiveBefore)
	if err != nil {
		return nil, fmt.Errorf("failed to scan/archive inactive sessions: %w", err)
	}
	defer rows.Close()

	var archivedIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan archived session id: %w", err)
		}
		archivedIDs = append(archivedIDs, id)
	}
	return archivedIDs, nil
}

func (r *Repository) ScanSessionsForDeprecate(ctx context.Context, deprecateBefore, archiveBefore time.Time) ([]string, error) {
	rows, err := r.pool.Query(ctx, db.QueryScanSessionsForDeprecate, deprecateBefore, archiveBefore)
	if err != nil {
		return nil, fmt.Errorf("failed to scan deprecated sessions: %w", err)
	}
	defer rows.Close()

	var deprecatedIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan deprecated session id: %w", err)
		}
		deprecatedIDs = append(deprecatedIDs, id)
	}
	return deprecatedIDs, nil
}

func (r *Repository) DeleteMessagesForArchivedSessions(ctx context.Context, archivedBefore time.Time) (int64, error) {
	tag, err := r.pool.Exec(ctx, db.QueryDeleteMessagesForArchivedSessions, archivedBefore)
	if err != nil {
		return 0, fmt.Errorf("failed to delete messages for archived sessions: %w", err)
	}
	return tag.RowsAffected(), nil
}

func (r *Repository) CountByUser(ctx context.Context, userID int) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, db.QueryCountSessions, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count sessions: %w", err)
	}
	return count, nil
}

func (r *Repository) CountMessagesBySession(ctx context.Context, sessionID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, db.QueryCountMessages, sessionID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count messages: %w", err)
	}
	return count, nil
}
