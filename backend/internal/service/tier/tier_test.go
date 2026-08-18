package tier

import (
	"context"
	domainconst "echo-backend/internal/constants/domain"
	"errors"
	"testing"
	"time"

	authmodel "echo-backend/internal/models/auth"
)

type fakeCache struct {
	values map[string]string
	err    error
	miss   bool
}

func (c *fakeCache) Get(_ context.Context, key string) (string, error) {
	if c.err != nil {
		return "", c.err
	}
	if c.miss {
		return "", nil
	}
	val, ok := c.values[key]
	if !ok {
		return "", nil
	}
	return val, nil
}

func (c *fakeCache) Set(_ context.Context, key, value string, _ time.Duration) error {
	if c.values == nil {
		c.values = map[string]string{}
	}
	c.values[key] = value
	return nil
}

type fakeRepo struct {
	users map[int]*authmodel.User
	err   error
}

func (r *fakeRepo) GetUserByID(_ context.Context, id int) (*authmodel.User, error) {
	if r.err != nil {
		return nil, r.err
	}
	return r.users[id], nil
}

func TestResolveCacheHit(t *testing.T) {
	cache := &fakeCache{values: map[string]string{"tier:7": "pro"}}
	svc := NewService(cache, &fakeRepo{})

	if got := svc.Resolve(context.Background(), "7"); got != "pro" {
		t.Fatalf("Resolve = %q, want pro", got)
	}
}

func TestResolveCacheMissBackfills(t *testing.T) {
	cache := &fakeCache{values: map[string]string{}, miss: true}
	repo := &fakeRepo{users: map[int]*authmodel.User{7: {ID: 7, Tier: "pro"}}}
	svc := NewService(cache, repo)

	if got := svc.Resolve(context.Background(), "7"); got != "pro" {
		t.Fatalf("Resolve = %q, want pro", got)
	}
	if cache.values["tier:7"] != "pro" {
		t.Fatalf("cache not backfilled, got %v", cache.values)
	}
}

func TestResolveCacheErrorFallsBackToDB(t *testing.T) {
	cache := &fakeCache{err: errors.New("redis down")}
	repo := &fakeRepo{users: map[int]*authmodel.User{7: {ID: 7, Tier: "pro"}}}
	svc := NewService(cache, repo)

	if got := svc.Resolve(context.Background(), "7"); got != "pro" {
		t.Fatalf("Resolve = %q, want pro (DB fallback)", got)
	}
}

func TestResolveDBErrorFailsClosed(t *testing.T) {
	cache := &fakeCache{miss: true}
	repo := &fakeRepo{err: errors.New("db down")}
	svc := NewService(cache, repo)

	if got := svc.Resolve(context.Background(), "7"); got != "free" {
		t.Fatalf("Resolve = %q, want free (fail-closed)", got)
	}
}

func TestResolveDBErrorNegativeCaches(t *testing.T) {
	cache := &fakeCache{values: map[string]string{}, miss: true}
	repo := &fakeRepo{err: errors.New("db down")}
	svc := NewService(cache, repo)

	if got := svc.Resolve(context.Background(), "7"); got != "free" {
		t.Fatalf("Resolve = %q, want free (fail-closed)", got)
	}
	if cache.values["tier:7"] != "free" {
		t.Fatalf("negative result not cached, got %v", cache.values)
	}
}

func TestResolveUnknownTierNormalizesToFree(t *testing.T) {
	cache := &fakeCache{miss: true}
	repo := &fakeRepo{users: map[int]*authmodel.User{7: {ID: 7, Tier: "admin"}}}
	svc := NewService(cache, repo)

	if got := svc.Resolve(context.Background(), "7"); got != "free" {
		t.Fatalf("Resolve = %q, want free (unknown tier)", got)
	}
}

func TestResolveInvalidUserIDFailsClosed(t *testing.T) {
	svc := NewService(nil, &fakeRepo{})

	if got := svc.Resolve(context.Background(), "not-a-number"); got != "free" {
		t.Fatalf("Resolve = %q, want free", got)
	}
}

func TestResolveNoCacheDegradesToDB(t *testing.T) {
	repo := &fakeRepo{users: map[int]*authmodel.User{7: {ID: 7, Tier: "pro"}}}
	svc := NewService(nil, repo)

	if got := svc.Resolve(context.Background(), "7"); got != "pro" {
		t.Fatalf("Resolve = %q, want pro (DB-only)", got)
	}
}

func TestNormalize(t *testing.T) {
	tests := map[string]string{"pro": "pro", "free": "free", "": "free", "PRO": "free", "gold": "free"}
	for in, want := range tests {
		if got := domainconst.NormalizeTier(in); got != want {
			t.Fatalf("NormalizeTier(%q) = %q, want %q", in, got, want)
		}
	}
}
