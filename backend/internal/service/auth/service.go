package auth

import (
	"context"
	authconst "echo-backend/internal/constants/auth"
	domainconst "echo-backend/internal/constants/domain"
	"echo-backend/internal/models/auth"
	"echo-backend/internal/models/config"
	"echo-backend/internal/repository/auth"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

// ErrInvalidCredentials is returned when the email does not exist or the
// password does not match. Both cases share one error (and message) so the
// handler cannot be used to enumerate registered emails.
var ErrInvalidCredentials = errors.New("invalid email or password")

// ErrDuplicateEmail is returned when registration hits the users.email unique
// constraint.
var ErrDuplicateEmail = errors.New("email already registered")

type Service struct {
	cfg      *cfgmodel.Config
	userRepo *auth.Repository
}

func NewService(cfg *cfgmodel.Config, userRepo *auth.Repository) *Service {
	return &Service{
		cfg:      cfg,
		userRepo: userRepo,
	}
}

func (s *Service) Login(ctx context.Context, email, password string) (*authmodel.User, string, error) {
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, "", err
	}
	if user == nil {
		return nil, "", ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, "", ErrInvalidCredentials
	}

	token, err := generateToken(s.cfg, user)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate token: %w", err)
	}

	return user, token, nil
}

func (s *Service) Register(ctx context.Context, email, password, name string) (*authmodel.User, string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", fmt.Errorf("failed to hash password: %w", err)
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
			return nil, "", ErrDuplicateEmail
		}
		return nil, "", fmt.Errorf("failed to create user: %w", err)
	}

	token, err := generateToken(s.cfg, user)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate token: %w", err)
	}

	return user, token, nil
}

func (s *Service) GetUserByID(ctx context.Context, id int) (*authmodel.User, error) {
	return s.userRepo.GetUserByID(ctx, id)
}

func generateToken(cfg *cfgmodel.Config, user *authmodel.User) (string, error) {
	claims := jwt.MapClaims{
		authconst.ClaimSubject: strconv.Itoa(user.ID),
		authconst.ClaimRole:    user.Role,
		authconst.ClaimEmail:   user.Email,
		authconst.ClaimExp:     time.Now().Add(72 * time.Hour).Unix(),
		authconst.ClaimIat:     time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}
