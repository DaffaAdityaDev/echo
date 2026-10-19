package chat

import (
	"reflect"
	"testing"
)

func TestTurnCleanupRunsStepsOnceInReverseOrder(t *testing.T) {
	var order []string
	cleanup := &turnCleanup{}
	cleanup.add(func() { order = append(order, "session lock") })
	cleanup.add(func() { order = append(order, "redis lock") })
	cleanup.add(func() { order = append(order, "active run") })

	cleanup.run()
	cleanup.run()

	want := []string{"active run", "redis lock", "session lock"}
	if !reflect.DeepEqual(order, want) {
		t.Errorf("order = %v, want %v", order, want)
	}
}

func TestUnregisterActiveRunKeepsNewerRun(t *testing.T) {
	const sessionID = "sess_unregister_test"
	oldRun := &activeRun{cancelCh: make(chan struct{})}
	newRun := &activeRun{cancelCh: make(chan struct{})}
	t.Cleanup(func() { unregisterActiveRun(sessionID, newRun) })

	registerActiveRun(sessionID, oldRun)
	registerActiveRun(sessionID, newRun)
	unregisterActiveRun(sessionID, oldRun)

	activeRunsMu.Lock()
	current := activeRuns[sessionID]
	activeRunsMu.Unlock()
	if current != newRun {
		t.Error("stale unregister removed the newer run")
	}

	unregisterActiveRun(sessionID, newRun)
	activeRunsMu.Lock()
	_, stillPresent := activeRuns[sessionID]
	activeRunsMu.Unlock()
	if stillPresent {
		t.Error("run was not unregistered")
	}
}
