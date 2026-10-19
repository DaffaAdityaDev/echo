package chat

import "sync"

// turnCleanup collects the release steps of a chat turn's session-scoped
// resources (session locks, active-run registration, interrupt watcher, agent
// request) and runs them once, in reverse registration order. Ownership moves
// to the SSE stream writer once streaming starts, because fasthttp runs that
// writer on its own goroutine that outlives the handler.
type turnCleanup struct {
	once  sync.Once
	steps []func()
}

func (t *turnCleanup) add(step func()) {
	t.steps = append(t.steps, step)
}

func (t *turnCleanup) run() {
	t.once.Do(func() {
		for i := len(t.steps) - 1; i >= 0; i-- {
			t.steps[i]()
		}
	})
}
