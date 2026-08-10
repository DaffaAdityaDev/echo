package chat

import (
	"sync"
	"testing"
	"time"
)

// TestSessionLockSerializesAndReleases hammers the same session with
// concurrent acquisitions: no two goroutines may hold the lock at once, and
// the refcounted map must return to empty so entries do not leak per session.
func TestSessionLockSerializesAndReleases(t *testing.T) {
	var active, maxActive int
	var mu sync.Mutex
	var wg sync.WaitGroup

	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			unlock := acquireSessionLock("sess-1")
			defer unlock()

			mu.Lock()
			active++
			if active > maxActive {
				maxActive = active
			}
			mu.Unlock()

			time.Sleep(time.Millisecond)

			mu.Lock()
			active--
			mu.Unlock()
		}()
	}
	wg.Wait()

	if maxActive != 1 {
		t.Fatalf("expected mutual exclusion (max concurrent holders = 1), got %d", maxActive)
	}

	sessionLocksMu.Lock()
	defer sessionLocksMu.Unlock()
	if n := len(sessionLocks); n != 0 {
		t.Fatalf("expected lock map empty after all releases, got %d entries", n)
	}
}

// TestSessionLockDifferentSessionsAreIndependent ensures locks are scoped per
// session: contention on one session must not block another.
func TestSessionLockDifferentSessionsAreIndependent(t *testing.T) {
	var wg sync.WaitGroup
	done := make(chan struct{})

	blocker := acquireSessionLock("sess-a")
	defer blocker()

	wg.Add(1)
	go func() {
		defer wg.Done()
		unlock := acquireSessionLock("sess-b")
		defer unlock()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("lock for sess-b blocked while sess-a is held")
	}
	wg.Wait()
}
