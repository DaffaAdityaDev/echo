package auth

import (
	"context"
	"crypto/sha256"
	"echo-backend/internal/models/auth"
	"echo-backend/internal/models/config"
	"encoding/hex"
	"errors"
	"testing"
	"time"
)

type fakeUserRepo struct {
	users   map[int]*authmodel.User
	byEmail map[string]*authmodel.User
	tokens  map[string]*authmodel.RefreshToken
	revoked []int64
	family  []int
}

func (f *fakeUserRepo) GetByEmail(_ context.Context, email string) (*authmodel.User, error) {
	return f.byEmail[email], nil
}

func (f *fakeUserRepo) GetUserByID(_ context.Context, id int) (*authmodel.User, error) {
	return f.users[id], nil
}

func (f *fakeUserRepo) Create(_ context.Context, user *authmodel.User) error {
	f.users[user.ID] = user
	return nil
}

func (f *fakeUserRepo) CreateRefreshToken(_ context.Context, userID int, tokenHash, deviceLabel string, expiresAt time.Time) (int64, error) {
	if f.tokens == nil {
		f.tokens = map[string]*authmodel.RefreshToken{}
	}
	id := int64(len(f.tokens) + 1)
	f.tokens[tokenHash] = &authmodel.RefreshToken{
		ID:          id,
		UserID:      userID,
		TokenHash:   tokenHash,
		DeviceLabel: deviceLabel,
		ExpiresAt:   expiresAt,
	}
	return id, nil
}

func (f *fakeUserRepo) FindRefreshTokenByHash(_ context.Context, tokenHash string) (*authmodel.RefreshToken, error) {
	return f.tokens[tokenHash], nil
}

func (f *fakeUserRepo) RevokeRefreshToken(_ context.Context, id int64) error {
	for _, rt := range f.tokens {
		if rt.ID == id && rt.RevokedAt == nil {
			now := time.Now()
			rt.RevokedAt = &now
		}
	}
	f.revoked = append(f.revoked, id)
	return nil
}

func (f *fakeUserRepo) RevokeRefreshTokensByUser(_ context.Context, userID int) error {
	for _, rt := range f.tokens {
		if rt.UserID == userID && rt.RevokedAt == nil {
			now := time.Now()
			rt.RevokedAt = &now
		}
	}
	f.family = append(f.family, userID)
	return nil
}

func newTestService(repo *fakeUserRepo) *Service {
	return NewService(&cfgmodel.Config{JWTSecret: "test-secret", DefaultUserTier: "free"}, repo)
}

func storedHash(t *testing.T, repo *fakeUserRepo, raw string) string {
	t.Helper()
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func TestGenerateTokenPairIssuesPairAndStoresHash(t *testing.T) {
	t.Parallel()

	repo := &fakeUserRepo{users: map[int]*authmodel.User{1: {ID: 1, Email: "jane@example.com", Role: "user"}}}
	svc := newTestService(repo)

	pair, err := svc.GenerateTokenPair(context.Background(), repo.users[1], "curl/8.0")
	if err != nil {
		t.Fatalf("GenerateTokenPair: %v", err)
	}
	if pair.AccessToken == "" || pair.RefreshToken == "" {
		t.Fatal("expected non-empty tokens")
	}
	if pair.ExpiresIn != int64(AccessTokenTTL.Seconds()) {
		t.Fatalf("ExpiresIn = %d, want %d", pair.ExpiresIn, int64(AccessTokenTTL.Seconds()))
	}
	if _, ok := repo.tokens[storedHash(t, repo, pair.RefreshToken)]; !ok {
		t.Fatal("refresh token hash not stored")
	}
	if _, ok := repo.tokens[pair.RefreshToken]; ok {
		t.Fatal("plaintext refresh token must never be stored")
	}
}

func TestRefreshAccessTokenRotates(t *testing.T) {
	t.Parallel()

	repo := &fakeUserRepo{users: map[int]*authmodel.User{1: {ID: 1, Email: "jane@example.com", Role: "user"}}}
	svc := newTestService(repo)

	first, err := svc.GenerateTokenPair(context.Background(), repo.users[1], "device-1")
	if err != nil {
		t.Fatalf("GenerateTokenPair: %v", err)
	}

	second, err := svc.RefreshAccessToken(context.Background(), first.RefreshToken, "device-2")
	if err != nil {
		t.Fatalf("RefreshAccessToken: %v", err)
	}
	if second.RefreshToken == first.RefreshToken {
		t.Fatal("refresh token must rotate")
	}

	old := repo.tokens[storedHash(t, repo, first.RefreshToken)]
	if old == nil || old.RevokedAt == nil {
		t.Fatal("old refresh token must be revoked")
	}
	if len(repo.tokens) != 2 {
		t.Fatalf("expected 2 stored tokens, got %d", len(repo.tokens))
	}
	if len(repo.family) != 0 {
		t.Fatal("family must not be revoked on a clean rotation")
	}
}

func TestRefreshAccessTokenRevokedTokenTriggersFamilyRevoke(t *testing.T) {
	t.Parallel()

	repo := &fakeUserRepo{users: map[int]*authmodel.User{1: {ID: 1, Email: "jane@example.com", Role: "user"}}}
	svc := newTestService(repo)

	first, err := svc.GenerateTokenPair(context.Background(), repo.users[1], "device-1")
	if err != nil {
		t.Fatalf("GenerateTokenPair: %v", err)
	}
	second, err := svc.RefreshAccessToken(context.Background(), first.RefreshToken, "device-2")
	if err != nil {
		t.Fatalf("first rotation: %v", err)
	}

	_, err = svc.RefreshAccessToken(context.Background(), first.RefreshToken, "thief")
	if !errors.Is(err, ErrRefreshTokenRevoked) {
		t.Fatalf("expected ErrRefreshTokenRevoked, got %v", err)
	}
	if len(repo.family) != 1 || repo.family[0] != 1 {
		t.Fatalf("expected family revoke for user 1, got %v", repo.family)
	}
	if repo.tokens[storedHash(t, repo, second.RefreshToken)].RevokedAt == nil {
		t.Fatal("family revoke must also kill the newest token")
	}
}

func TestRefreshAccessTokenUnknownToken(t *testing.T) {
	t.Parallel()

	repo := &fakeUserRepo{users: map[int]*authmodel.User{1: {ID: 1, Email: "jane@example.com", Role: "user"}}}
	svc := newTestService(repo)

	_, err := svc.RefreshAccessToken(context.Background(), "made-up-token", "device")
	if !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("expected ErrInvalidRefreshToken, got %v", err)
	}
	if len(repo.revoked) != 0 || len(repo.family) != 0 {
		t.Fatal("unknown token must not trigger any revocation")
	}
}

func TestRefreshAccessTokenExpired(t *testing.T) {
	t.Parallel()

	repo := &fakeUserRepo{users: map[int]*authmodel.User{1: {ID: 1, Email: "jane@example.com", Role: "user"}}}
	svc := newTestService(repo)

	pair, err := svc.GenerateTokenPair(context.Background(), repo.users[1], "device")
	if err != nil {
		t.Fatalf("GenerateTokenPair: %v", err)
	}
	hash := storedHash(t, repo, pair.RefreshToken)
	repo.tokens[hash].ExpiresAt = time.Now().Add(-time.Minute)

	_, err = svc.RefreshAccessToken(context.Background(), pair.RefreshToken, "device")
	if !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("expected ErrInvalidRefreshToken, got %v", err)
	}
	if repo.tokens[hash].RevokedAt != nil {
		t.Fatal("expired token must not be revoked, only rejected")
	}
}

func TestRefreshAccessTokenEmpty(t *testing.T) {
	t.Parallel()

	svc := newTestService(&fakeUserRepo{})
	if _, err := svc.RefreshAccessToken(context.Background(), "", "device"); !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("expected ErrInvalidRefreshToken, got %v", err)
	}
}

func TestRevokeRefreshToken(t *testing.T) {
	t.Parallel()

	repo := &fakeUserRepo{users: map[int]*authmodel.User{1: {ID: 1, Email: "jane@example.com", Role: "user"}}}
	svc := newTestService(repo)

	pair, err := svc.GenerateTokenPair(context.Background(), repo.users[1], "device")
	if err != nil {
		t.Fatalf("GenerateTokenPair: %v", err)
	}

	if err := svc.RevokeRefreshToken(context.Background(), pair.RefreshToken); err != nil {
		t.Fatalf("RevokeRefreshToken: %v", err)
	}
	if repo.tokens[storedHash(t, repo, pair.RefreshToken)].RevokedAt == nil {
		t.Fatal("token must be revoked after logout")
	}

	if err := svc.RevokeRefreshToken(context.Background(), ""); err != nil {
		t.Fatalf("empty token must be a no-op, got %v", err)
	}
	if err := svc.RevokeRefreshToken(context.Background(), "unknown"); err != nil {
		t.Fatalf("unknown token must be a no-op, got %v", err)
	}
}
