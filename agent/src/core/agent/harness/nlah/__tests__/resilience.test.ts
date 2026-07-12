import { describe, test, expect } from 'bun:test';
import { CircuitBreaker } from '../circuit_breaker';
import { DegradationManager } from '../degradation';
import { compressObservation } from '../utils/compress';
import { AgentStatusTracker } from '../utils/status_tracker';
import { Observation } from '../../../../../shared/types';

describe('Resilience & Status Components', () => {
  describe('CircuitBreaker', () => {
    test('trips after configured failures', () => {
      const breaker = new CircuitBreaker({ openAfter: 3, maxRetriesPerTool: 3 });
      expect(breaker.isOpen('test_tool')).toBe(false);

      breaker.recordFailure('test_tool');
      expect(breaker.isOpen('test_tool')).toBe(false);

      breaker.recordFailure('test_tool');
      expect(breaker.isOpen('test_tool')).toBe(false);

      breaker.recordFailure('test_tool');
      expect(breaker.isOpen('test_tool')).toBe(true);
    });

    test('resets failures on success', () => {
      const breaker = new CircuitBreaker({ openAfter: 3, maxRetriesPerTool: 5 });
      breaker.recordFailure('test_tool');
      breaker.recordFailure('test_tool');
      breaker.recordSuccess('test_tool');
      breaker.recordFailure('test_tool');
      expect(breaker.isOpen('test_tool')).toBe(false);
    });

    test('maintains list of open circuits', () => {
      const breaker = new CircuitBreaker({ openAfter: 1, maxRetriesPerTool: 1 });
      breaker.recordFailure('toolA');
      breaker.recordFailure('toolB');
      expect(breaker.getAllOpenCircuits()).toEqual(['toolA', 'toolB']);
    });
  });

  describe('DegradationManager', () => {
    test('transitions levels based on failure count', () => {
      const manager = new DegradationManager({ degradeAfter: 3, abortAfter: 7 });
      expect(manager.getLevel()).toBe('normal');
      expect(manager.isDegraded()).toBe(false);
      expect(manager.shouldAbort()).toBe(false);

      // 1 failure
      manager.recordToolError();
      expect(manager.getLevel()).toBe('normal');

      // 2 failures
      manager.recordToolError();
      expect(manager.getLevel()).toBe('normal');

      // 3 failures -> restricted
      manager.recordToolError();
      expect(manager.getLevel()).toBe('restricted');
      expect(manager.isDegraded()).toBe(true);

      // 4 failures -> restricted
      manager.recordToolError();
      expect(manager.getLevel()).toBe('restricted');

      // 5 failures -> standard
      manager.recordToolError();
      expect(manager.getLevel()).toBe('standard');
      expect(manager.isDegraded()).toBe(true);
      expect(manager.shouldAbort()).toBe(false);

      // 6 failures
      manager.recordToolError();

      // 7 failures -> Abort
      manager.recordToolError();
      expect(manager.shouldAbort()).toBe(true);
    });

    test('resets failures correctly', () => {
      const manager = new DegradationManager({ degradeAfter: 3, abortAfter: 7 });
      manager.recordToolError();
      manager.recordToolError();
      manager.reset();
      expect(manager.getLevel()).toBe('normal');
    });
  });

  describe('Observation Compression', () => {
    test('truncates to first sentence and appends retry info', () => {
      const obs: Observation = {
        status: 'error',
        summary: 'Database connection failed. Check config and credentials. Host is unreachable.',
      };

      const compressed = compressObservation(obs, 1, 3, false);
      expect(compressed.status).toBe('error');
      expect(compressed.summary).toBe('Database connection failed. (retry 1/3)');
    });

    test('truncates to first sentence and appends circuit open info', () => {
      const obs: Observation = {
        status: 'error',
        summary: 'Network timeout occurred. Please try again.',
      };

      const compressed = compressObservation(obs, 3, 3, true);
      // Tripped circuit with failures >= 3 returns empty summary
      expect(compressed.summary).toBe('');
    });

    test('appends circuit open info if failures < 3', () => {
      const obs: Observation = {
        status: 'error',
        summary: 'Network timeout occurred. Please try again.',
      };

      const compressed = compressObservation(obs, 2, 3, true);
      expect(compressed.summary).toBe('Network timeout occurred. (circuit open)');
    });
  });

  describe('AgentStatusTracker', () => {
    test('tracks states and triggers change events', () => {
      const tracker = new AgentStatusTracker(1, 15, 'agent');
      expect(tracker.getStatus().state).toBe('starting');

      const change1 = tracker.update({ state: 'running' });
      expect(change1.changed).toBe(true);
      expect(change1.from).toBe('starting');
      expect(change1.to).toBe('running');

      const change2 = tracker.update({ currentTool: 'web_search' });
      // state remains 'running', only tool changed
      expect(change2.changed).toBe(false);
      expect(tracker.getStatus().currentTool).toBe('web_search');
    });
  });
});
