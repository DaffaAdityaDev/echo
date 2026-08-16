package chat

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	redisSessionLockTTL    = 5 * time.Minute
	redisSessionLockPoll   = 250 * time.Millisecond
	redisSessionLockKeyFmt = "lock:session:%s"
)

var (
	sessionUnlockScript = redis.NewScript(`
if redis.call("get", KEYS[1]) == ARGV[1] then
	return redis.call("del", KEYS[1])
end
return 0
`)
	sessionRenewScript = redis.NewScript(`
if redis.call("get", KEYS[1]) == ARGV[1] then
	return redis.call("pexpire", KEYS[1], ARGV[2])
end
return 0
`)
)

func sessionLockKey(sessionID string) string {
	return fmt.Sprintf(redisSessionLockKeyFmt, sessionID)
}

func newLockToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// acquireRedisSessionLock serializes chat turns on the same session across
// gateway instances (the in-process acquireSessionLock only covers a single
// process). Without it, two instances could run the same session's missions
// concurrently and the agent's per-turn event-stream reset would clobber the
// in-flight stream. Returns a nil unlock when Redis is unavailable - those
// deployments rely on the in-process lock alone.
func acquireRedisSessionLock(ctx context.Context, rdb *redis.Client, sessionID string) (string, func(), error) {
	noop := func() {}
	if rdb == nil {
		return "", noop, nil
	}
	token, err := newLockToken()
	if err != nil {
		return "", noop, err
	}
	key := sessionLockKey(sessionID)
	for {
		ok, setErr := rdb.SetNX(ctx, key, token, redisSessionLockTTL).Result()
		if setErr != nil {
			return "", noop, setErr
		}
		if ok {
			break
		}
		select {
		case <-ctx.Done():
			return "", noop, ctx.Err()
		case <-time.After(redisSessionLockPoll):
		}
	}
	return token, func() {
		unlockCtx, unlockCancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer unlockCancel()
		if err := sessionUnlockScript.Run(unlockCtx, rdb, []string{key}, token).Err(); err != nil {
			slog.Error("failed to release session lock", "component", "chat", "session_id", sessionID, "err", err)
		}
	}, nil
}

// renewRedisSessionLock extends the lock TTL while a turn is streaming. The
// compare-and-renew is a no-op once the token is gone (TTL expired and
// another instance took over, or the lock was released), so a stale process
// can never steal back a lock it no longer owns.
func renewRedisSessionLock(ctx context.Context, rdb *redis.Client, sessionID, token string) {
	if rdb == nil || token == "" {
		return
	}
	key := sessionLockKey(sessionID)
	if err := sessionRenewScript.Run(ctx, rdb, []string{key}, token, int64(redisSessionLockTTL/time.Millisecond)).Err(); err != nil {
		slog.Error("failed to renew session lock", "component", "chat", "session_id", sessionID, "err", err)
	}
}
