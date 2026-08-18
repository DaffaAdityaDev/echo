package tier

import (
	"context"
	domainconst "echo-backend/internal/constants/domain"
	"strconv"
	"time"

	authmodel "echo-backend/internal/models/auth"

	"github.com/redis/go-redis/v9"
)

const (
	cacheKeyPrefix = "tier:"
	cacheTTL       = 60 * time.Second
	// cacheNegativeTTL applies when the database miss or errors. It is shorter
	// than cacheTTL so a recovered database re-evaluates tiers quickly instead
	// of keeping every user locked to free for a full minute.
	cacheNegativeTTL = 15 * time.Second
)

// UserRepository returns the user's stored tier by id. It mirrors the auth
// repository contract so tests can substitute a fake.
type UserRepository interface {
	GetUserByID(ctx context.Context, id int) (*authmodel.User, error)
}

// Cache is the minimal Redis surface the tier service needs, abstracted so
// unit tests can run without a real Redis.
type Cache interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key string, value string, ttl time.Duration) error
}

type Service struct {
	rdb  Cache
	repo UserRepository
}

func NewService(rdb Cache, repo UserRepository) *Service {
	return &Service{rdb: rdb, repo: repo}
}

// NewRedisCache adapts a go-redis client to the Cache interface. A nil client
// yields a nil Cache, letting the service degrade to database-only reads.
func NewRedisCache(client *redis.Client) Cache {
	if client == nil {
		return nil
	}
	return redisCache{client: client}
}

type redisCache struct {
	client *redis.Client
}

func (c redisCache) Get(ctx context.Context, key string) (string, error) {
	return c.client.Get(ctx, key).Result()
}

func (c redisCache) Set(ctx context.Context, key string, value string, ttl time.Duration) error {
	return c.client.Set(ctx, key, value, ttl).Err()
}

// Resolve returns the user's current tier, reading through the cache first
// (cache-aside) and falling back to the database. Any failure — cache miss,
// Redis or DB error, unknown value — resolves to TierFree so access is never
// accidentally granted. Redis itself is optional: with a nil cache the
// service degrades to a straight database read. Cache misses and DB failures
// are cached briefly (negative caching) so a transient outage does not turn
// every authenticated request into a database round trip.
func (s *Service) Resolve(ctx context.Context, userID string) string {
	key := cacheKeyPrefix + userID

	if s.rdb != nil {
		if cached, err := s.rdb.Get(ctx, key); err == nil && cached != "" {
			return domainconst.NormalizeTier(cached)
		}
	}

	id, err := strconv.Atoi(userID)
	if err != nil {
		return domainconst.TierFree
	}

	user, err := s.repo.GetUserByID(ctx, id)
	if err != nil || user == nil {
		if s.rdb != nil {
			_ = s.rdb.Set(ctx, key, domainconst.TierFree, cacheNegativeTTL)
		}
		return domainconst.TierFree
	}

	tier := domainconst.NormalizeTier(user.Tier)
	if s.rdb != nil {
		_ = s.rdb.Set(ctx, key, tier, cacheTTL)
	}
	return tier
}
