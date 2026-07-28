import { LoopDetector } from '../loop_detector';

describe('LoopDetector', () => {
  it('default config enables detection', () => {
    const d = new LoopDetector();
    expect(d.isEnabled()).toBe(true);
  });

  it('disabled config returns pass-through results', () => {
    const d = new LoopDetector({ enabled: false });
    const r = d.recordAndCheck('web_search', { q: 'hi' });
    expect(r.isLoop).toBe(false);
    expect(r.count).toBe(0);
    expect(r.hash).toBe('');
  });

  it('generateHash produces deterministic result for same inputs', () => {
    const d = new LoopDetector();
    const h1 = d.generateHash('tool_a', { a: 1, b: 2 });
    const h2 = d.generateHash('tool_a', { b: 2, a: 1 });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{32}$/);
  });

  it('generateHash produces different result for different inputs', () => {
    const d = new LoopDetector();
    const h1 = d.generateHash('tool_a', { x: 1 });
    const h2 = d.generateHash('tool_b', { x: 1 });
    expect(h1).not.toBe(h2);
  });

  it('recordAndCheck counts consecutive identical calls', () => {
    const d = new LoopDetector({ maxConsecutiveIdenticalCalls: 3, enabled: true });
    expect(d.recordAndCheck('read_file', { path: '/a' }).count).toBe(1);
    expect(d.recordAndCheck('read_file', { path: '/a' }).count).toBe(2);
    const r3 = d.recordAndCheck('read_file', { path: '/a' });
    expect(r3.count).toBe(3);
    expect(r3.isLoop).toBe(true);
  });

  it('non-consecutive identical calls reset the count', () => {
    const d = new LoopDetector({ maxConsecutiveIdenticalCalls: 3, enabled: true });
    d.recordAndCheck('read_file', { path: '/a' });
    d.recordAndCheck('read_file', { path: '/a' });
    d.recordAndCheck('write_file', { path: '/b' });
    expect(d.recordAndCheck('read_file', { path: '/a' }).count).toBe(1);
  });

  it('ring buffer is limited by windowSize', () => {
    const d = new LoopDetector({ windowSize: 3, enabled: true });
    d.recordAndCheck('a', {});
    d.recordAndCheck('b', {});
    d.recordAndCheck('c', {});
    d.recordAndCheck('d', {});
    expect(d.getHistory().length).toBe(3);
  });

  it('restoreHistory sets internal state', () => {
    const d = new LoopDetector();
    d.recordAndCheck('a', {});
    d.restoreHistory(['hash_x', 'hash_y']);
    expect(d.getHistory()).toEqual(['hash_x', 'hash_y']);
  });

  it('restoreHistory accepts empty array', () => {
    const d = new LoopDetector();
    d.recordAndCheck('a', {});
    d.restoreHistory([]);
    expect(d.getHistory()).toEqual([]);
  });

  it('getHistory returns a shallow copy', () => {
    const d = new LoopDetector();
    d.recordAndCheck('a', {});
    const hist = d.getHistory();
    d.recordAndCheck('b', {});
    expect(hist.length).toBe(1);
  });

  it('clear empties history', () => {
    const d = new LoopDetector();
    d.recordAndCheck('a', {});
    d.clear();
    expect(d.getHistory()).toEqual([]);
    expect(d.isEnabled()).toBe(true);
  });

  it('isEnabled reflects config', () => {
    expect(new LoopDetector({ enabled: false }).isEnabled()).toBe(false);
    expect(new LoopDetector({ enabled: true }).isEnabled()).toBe(true);
  });
});
