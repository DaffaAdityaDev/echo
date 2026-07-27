
import { AgentStatusTracker } from '../status-tracker';

describe('AgentStatusTracker', () => {
  it('initial state is starting', () => {
    const tracker = new AgentStatusTracker(1, 15, 'agent');
    const status = tracker.getStatus();
    expect(status.state).toBe('starting');
  });

  it('transitions starting -> running -> completed', () => {
    const tracker = new AgentStatusTracker(0, 10, 'agent');

    expect(tracker.getStatus().state).toBe('starting');

    const r1 = tracker.update({ state: 'running' });
    expect(r1.changed).toBe(true);
    expect(r1.from).toBe('starting');
    expect(r1.to).toBe('running');
    expect(tracker.getStatus().state).toBe('running');

    const r2 = tracker.update({ state: 'completed' });
    expect(r2.changed).toBe(true);
    expect(r2.from).toBe('running');
    expect(r2.to).toBe('completed');
    expect(tracker.getStatus().state).toBe('completed');
  });

  it('getStatus returns state, step, maxSteps, strategy, and lastActivity', () => {
    const before = Date.now();
    const tracker = new AgentStatusTracker(3, 15, 'restricted');
    const s = tracker.getStatus();

    expect(s.state).toBe('starting');
    expect(s.step).toBe(3);
    expect(s.maxSteps).toBe(15);
    expect(s.strategy).toBe('restricted');
    expect(new Date(s.lastActivity).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('update refreshes lastActivity timestamp', () => {
    const tracker = new AgentStatusTracker(0, 10, 'agent');
    const before = Date.now();

    tracker.update({ state: 'running' });

    const after = tracker.getStatus();
    expect(new Date(after.lastActivity).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('update without state change returns changed=false', () => {
    const tracker = new AgentStatusTracker(0, 10, 'agent');
    tracker.update({ state: 'running' });

    const result = tracker.update({ currentTool: 'search' });
    expect(result.changed).toBe(false);
    expect(result.from).toBe('running');
    expect(result.to).toBe('running');
  });

  it('getStatus returns a shallow copy of activeCircuitBreakers', () => {
    const tracker = new AgentStatusTracker(0, 10, 'agent');
    const s1 = tracker.getStatus();
    expect(s1.activeCircuitBreakers).toEqual([]);
    expect(Array.isArray(s1.activeCircuitBreakers)).toBe(true);
  });
});
