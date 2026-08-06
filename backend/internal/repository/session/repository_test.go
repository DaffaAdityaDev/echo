package session

import (
	"bufio"
	"context"
	"echo-backend/internal/models/chat"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSessionRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	if f, err := os.Open("../../../.env"); err == nil {
		defer f.Close()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			if parts := strings.SplitN(line, "=", 2); len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				if _, ok := os.LookupEnv(key); !ok {
					os.Setenv(key, val)
				}
			}
		}
	}
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping integration test")
	}

	ctx := context.Background()
	connCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	poolCfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		t.Skipf("Failed to parse database config, skipping: %v", err)
	}
	poolCfg.MaxConns = 10
	poolCfg.MinConns = 2

	pool, err := pgxpool.NewWithConfig(connCtx, poolCfg)
	if err != nil {
		t.Skipf("Failed to create connection pool, skipping: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(connCtx); err != nil {
		t.Skipf("Database unreachable, skipping integration test: %v", err)
	}

	fmt.Println("Connected to PostgreSQL successfully")

	repo := NewRepository(pool)

	var testUserID int
	err = pool.QueryRow(ctx, "INSERT INTO users (email, password_hash, name, role) VALUES ('test-session-owner@echo.ai', 'hash', 'Owner', 'user') ON CONFLICT (email) DO UPDATE SET name='Owner' RETURNING id").Scan(&testUserID)
	if err != nil {
		t.Fatalf("Failed to ensure test user: %v", err)
	}

	session, err := repo.CreateSession(ctx, testUserID, "Test Session Title", "nlah:v1")

	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}
	if session.Title != "Test Session Title" {
		t.Errorf("Expected title 'Test Session Title', got '%s'", session.Title)
	}
	if session.ID == "" {
		t.Error("Expected generated session ID, got empty string")
	}

	userMsg := &chatmodel.Message{
		Role:       "user",
		Content:    "Hello agent!",
		TokenCount: 3,
		TurnNumber: 1,
	}
	assistantMsg := &chatmodel.Message{
		Role:       "assistant",
		Content:    "Hello user! How can I help you today?",
		TokenCount: 10,
		TurnNumber: 1,
	}
	toolResult := &chatmodel.Message{
		Role:       "tool_result",
		Content:    "search result: success",
		TokenCount: 4,
		TurnNumber: 1,
	}

	err = repo.SaveTurnMessages(ctx, session.ID, userMsg, assistantMsg, []*chatmodel.Message{toolResult})
	if err != nil {
		t.Fatalf("Failed to save turn messages: %v", err)
	}

	messages, err := repo.GetSessionMessages(ctx, session.ID, 0, 0)
	if err != nil {
		t.Fatalf("Failed to get session messages: %v", err)
	}
	if len(messages) != 3 {
		t.Errorf("Expected 3 messages, got %d", len(messages))
	}

	maxTurn, err := repo.GetMaxTurnNumber(ctx, session.ID)
	if err != nil {
		t.Fatalf("Failed to get max turn number: %v", err)
	}
	if maxTurn != 1 {
		t.Errorf("Expected max turn 1, got %d", maxTurn)
	}

	tokenCount, err := repo.GetSessionTokenCount(ctx, session.ID)
	if err != nil {
		t.Fatalf("Failed to get token count: %v", err)
	}
	if tokenCount != 17 {
		t.Errorf("Expected token count 17, got %d", tokenCount)
	}

	sessions, err := repo.ListByUser(ctx, testUserID, 0, 0)
	if err != nil {
		t.Fatalf("Failed to list sessions: %v", err)
	}
	found := false
	for _, s := range sessions {
		if s.ID == session.ID {
			found = true
			if s.MessageCount != 3 {
				t.Errorf("Expected s.MessageCount == 3, got %d", s.MessageCount)
			}
			if s.TokenCount != 17 {
				t.Errorf("Expected s.TokenCount == 17, got %d", s.TokenCount)
			}
		}
	}
	if !found {
		t.Error("Expected to find created session in list")
	}

	// Test Pagination for Sessions
	session2, err := repo.CreateSession(ctx, testUserID, "Test Session 2 Title", "nlah:v1")
	if err != nil {
		t.Fatalf("Failed to create second session: %v", err)
	}
	defer repo.DeleteSession(ctx, session2.ID)

	sessionsLimit, err := repo.ListByUser(ctx, testUserID, 1, 0)
	if err != nil {
		t.Fatalf("Failed to list sessions with limit: %v", err)
	}
	if len(sessionsLimit) != 1 {
		t.Errorf("Expected 1 session with limit=1, got %d", len(sessionsLimit))
	}

	// Test Pagination for Messages
	// Current messages in session: 3 messages (turn 1)
	// Add 2 more messages (turn 2)
	msg4 := &chatmodel.Message{Role: "user", Content: "Second turn user", TokenCount: 3, TurnNumber: 2}
	msg5 := &chatmodel.Message{Role: "assistant", Content: "Second turn assistant", TokenCount: 5, TurnNumber: 2}
	err = repo.SaveTurnMessages(ctx, session.ID, msg4, msg5, nil)
	if err != nil {
		t.Fatalf("Failed to save second turn: %v", err)
	}

	// Session now has 5 messages. Fetch latest 2 (should be turn 2 user & assistant)
	messagesLimit, err := repo.GetSessionMessages(ctx, session.ID, 2, 0)
	if err != nil {
		t.Fatalf("Failed to get session messages with limit: %v", err)
	}
	if len(messagesLimit) != 2 {
		t.Errorf("Expected 2 messages with limit=2, got %d", len(messagesLimit))
	}
	if messagesLimit[0].TurnNumber != 2 || messagesLimit[1].TurnNumber != 2 {
		t.Errorf("Expected turn 2 messages, got turns %d and %d", messagesLimit[0].TurnNumber, messagesLimit[1].TurnNumber)
	}

	// Fetch next older 2 (should be turn 1 messages)
	messagesOffset, err := repo.GetSessionMessages(ctx, session.ID, 2, 2)
	if err != nil {
		t.Fatalf("Failed to get session messages with offset: %v", err)
	}
	if len(messagesOffset) != 2 {
		t.Errorf("Expected 2 messages with offset=2, got %d", len(messagesOffset))
	}
	if messagesOffset[0].TurnNumber != 1 || messagesOffset[1].TurnNumber != 1 {
		t.Errorf("Expected turn 1 messages, got turns %d and %d", messagesOffset[0].TurnNumber, messagesOffset[1].TurnNumber)
	}

	// Test counting sessions
	totalSessions, err := repo.CountByUser(ctx, testUserID)
	if err != nil {
		t.Fatalf("Failed to count sessions: %v", err)
	}
	if totalSessions <= 0 {
		t.Errorf("Expected positive session count, got %d", totalSessions)
	}

	// Test counting messages
	totalMessages, err := repo.CountMessagesBySession(ctx, session.ID)
	if err != nil {
		t.Fatalf("Failed to count messages: %v", err)
	}
	if totalMessages != 5 {
		t.Errorf("Expected 5 total messages, got %d", totalMessages)
	}

	err = repo.DeleteSession(ctx, session.ID)
	if err != nil {
		t.Fatalf("Failed to delete session: %v", err)
	}

	deletedSession, err := repo.GetByID(ctx, session.ID)
	if err != nil {
		t.Fatalf("Failed to query deleted session: %v", err)
	}
	if deletedSession.Status != "deleted" {
		t.Errorf("Expected session status to be 'deleted', got '%s'", deletedSession.Status)
	}
}
