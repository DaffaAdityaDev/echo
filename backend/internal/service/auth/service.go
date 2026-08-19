package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	authconst "echo-backend/internal/constants/auth"
	domainconst "echo-backend/internal/constants/domain"
	"echo-backend/internal/models/auth"
	"echo-backend/internal/models/config"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

const (
	// AccessTokenTTL is how long an access token stays valid. It is short so a
	// stolen token has a small blast radius.
	AccessTokenTTL = 15 * time.Minute
	// RefreshTokenTTL is how long a refresh token stays valid before the user
	// must log in again.
	RefreshTokenTTL = 30 * 24 * time.Hour
	// refreshTokenBytes is the entropy of a refresh token: 256 random bits,
	// which makes brute force infeasible and sha256 hashing (instead of a
	// slow KDF) safe for storage.
	refreshTokenBytes = 32
)

// ErrInvalidCredentials is returned when the email does not exist or the
// password does not match. Both cases share one error (and message) so the
// handler cannot be used to enumerate registered emails.
var ErrInvalidCredentials = errors.New("invalid email or password")

// ErrDuplicateEmail is returned when registration hits the users.email unique
// constraint.
var ErrDuplicateEmail = errors.New("email already registered")

// ErrInvalidRefreshToken is returned when the presented refresh token does
// not exist or has expired. The handler must not distinguish this from a
// revoked token beyond the status code, so clients cannot probe the store.
var ErrInvalidRefreshToken = errors.New("invalid refresh token")

// ErrRefreshTokenRevoked is returned when a previously revoked refresh token
// is presented again. Reusing a revoked token is treated as theft: the whole
// token family is revoked and the client gets a 401.
var ErrRefreshTokenRevoked = errors.New("refresh token has been revoked")

// TokenPair is the result of a successful login or refresh: a short-lived
// access token plus a long-lived refresh token. RefreshToken is shown to the
// client exactly once; only its sha256 hash is persisted.
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
}

// UserRepository is the persistence surface the auth service needs, abstracted
// so unit tests can substitute a fake. The concrete *auth.Repository from
// repository/auth satisfies it.
type UserRepository interface {
	GetByEmail(ctx context.Context, email string) (*authmodel.User, error)
	GetUserByID(ctx context.Context, id int) (*authmodel.User, error)
	Create(ctx context.Context, user *authmodel.User) error
	CreateRefreshToken(ctx context.Context, userID int, tokenHash, deviceLabel string, expiresAt time.Time) (int64, error)
	FindRefreshTokenByHash(ctx context.Context, tokenHash string) (*authmodel.RefreshToken, error)
	RevokeRefreshToken(ctx context.Context, id int64) error
	RevokeRefreshTokensByUser(ctx context.Context, userID int) error
}

type Service struct {
	cfg      *cfgmodel.Config
	userRepo UserRepository
}

func NewService(cfg *cfgmodel.Config, userRepo UserRepository) *Service {
	return &Service{
		cfg:      cfg,
		userRepo: userRepo,
	}
}

func (s *Service) Login(ctx context.Context, email, password, deviceLabel string) (*authmodel.User, *TokenPair, error) {
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, nil, err
	}
	if user == nil {
		return nil, nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	pair, err := s.GenerateTokenPair(ctx, user, deviceLabel)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate token pair: %w", err)
	}

	return user, pair, nil
}

func (s *Service) Register(ctx context.Context, email, password, name, deviceLabel string) (*authmodel.User, *TokenPair, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := &authmodel.User{
		Email:        email,
		PasswordHash: string(hashedPassword),
		Name:         name,
		Role:         domainconst.RoleUser,
		Tier:         s.cfg.DefaultUserTier,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, nil, ErrDuplicateEmail
		}
		return nil, nil, fmt.Errorf("failed to create user: %w", err)
	}

	pair, err := s.GenerateTokenPair(ctx, user, deviceLabel)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate token pair: %w", err)
	}

	return user, pair, nil
}

func (s *Service) GetUserByID(ctx context.Context, id int) (*authmodel.User, error) {
	return s.userRepo.GetUserByID(ctx, id)
}

// GenerateTokenPair mints a fresh access token and a fresh refresh token,
// persisting the refresh token's hash. It is the single entry point for
// issuing credentials (login, register, refresh).
func (s *Service) GenerateTokenPair(ctx context.Context, user *authmodel.User, deviceLabel string) (*TokenPair, error) {
	access, err := generateToken(s.cfg, user, AccessTokenTTL)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	raw, hash, err := generateRefreshToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	if _, err := s.userRepo.CreateRefreshToken(ctx, user.ID, hash, deviceLabel, time.Now().Add(RefreshTokenTTL)); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  access,
		RefreshToken: raw,
		ExpiresIn:    int64(AccessTokenTTL.Seconds()),
	}, nil
}

// RefreshAccessToken rotates a refresh token: the presented token is revoked
// and a fresh pair is issued. Presenting a token that was already revoked
// triggers reuse detection, which revokes every refresh token belonging to
// the user (token family) before rejecting the request.
func (s *Service) RefreshAccessToken(ctx context.Context, refreshToken, deviceLabel string) (*TokenPair, error) {
	if refreshToken == "" {
		return nil, ErrInvalidRefreshToken
	}

	rt, err := s.userRepo.FindRefreshTokenByHash(ctx, hashRefreshToken(refreshToken))
	if err != nil {
		return nil, fmt.Errorf("failed to find refresh token: %w", err)
	}
	if rt == nil {
		return nil, ErrInvalidRefreshToken
	}

	if rt.RevokedAt != nil {
		_ = s.userRepo.RevokeRefreshTokensByUser(ctx, rt.UserID)
		return nil, ErrRefreshTokenRevoked
	}

	if time.Now().After(rt.ExpiresAt) {
		return nil, ErrInvalidRefreshToken
	}

	if err := s.userRepo.RevokeRefreshToken(ctx, rt.ID); err != nil {
		return nil, fmt.Errorf("failed to rotate refresh token: %w", err)
	}

	user, err := s.userRepo.GetUserByID(ctx, rt.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user for refresh: %w", err)
	}
	if user == nil {
		return nil, ErrInvalidRefreshToken
	}

	return s.GenerateTokenPair(ctx, user, deviceLabel)
}

// RevokeRefreshToken invalidates a single refresh token on logout. An empty
// or unknown token is a no-op so logout always succeeds and clears cookies.
func (s *Service) RevokeRefreshToken(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}

	rt, err := s.userRepo.FindRefreshTokenByHash(ctx, hashRefreshToken(refreshToken))
	if err != nil {
		return fmt.Errorf("failed to find refresh token: %w", err)
	}
	if rt == nil {
		return nil
	}

	return s.userRepo.RevokeRefreshToken(ctx, rt.ID)
}

func generateToken(cfg *cfgmodel.Config, user *authmodel.User, ttl time.Duration) (string, error) {
	claims := jwt.MapClaims{
		authconst.ClaimSubject: strconv.Itoa(user.ID),
		authconst.ClaimRole:    user.Role,
		authconst.ClaimEmail:   user.Email,
		authconst.ClaimExp:     time.Now().Add(ttl).Unix(),
		authconst.ClaimIat:     time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}

func generateRefreshToken() (raw, hash string, err error) {
	buf := make([]byte, refreshTokenBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(buf)
	return raw, hashRefreshToken(raw), nil
}

func hashRefreshToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
