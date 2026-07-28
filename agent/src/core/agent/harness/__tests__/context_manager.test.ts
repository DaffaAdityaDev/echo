import { ContextManager } from '../context_manager';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

describe('ContextManager', () => {
  it('default config enables all features', () => {
    const cm = new ContextManager();
    const cfg = cm.getConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.enablePrefixCachingLayout).toBe(true);
    expect(cfg.enableAutoCompaction).toBe(true);
  });

  describe('prepareMessagesPayload', () => {
    const system = 'You are a helpful assistant.';
    const env = 'OS: Windows, CWD: /project';
    const msgs = [new HumanMessage('hello')];

    it('without prefix caching returns single system message', () => {
      const cm = new ContextManager({ enablePrefixCachingLayout: false });
      const result = cm.prepareMessagesPayload(system, env, msgs);
      expect(result).toHaveLength(2);
      expect((result[0] as SystemMessage).content.toString()).toContain(system);
      expect((result[0] as SystemMessage).content.toString()).toContain(env);
      expect(result[1]).toBe(msgs[0]);
    });

    it('with prefix caching splits system and env messages', () => {
      const cm = new ContextManager({ enablePrefixCachingLayout: true });
      const result = cm.prepareMessagesPayload(system, env, msgs);
      expect(result).toHaveLength(3);
      expect((result[0] as SystemMessage).content.toString()).toBe(system);
      expect((result[1] as SystemMessage).content.toString()).toContain(env);
      expect(result[2]).toBe(msgs[0]);
    });

    it('includes summary anchor when set', () => {
      const cm = new ContextManager({ enablePrefixCachingLayout: true });
      cm.setSummaryAnchor('Previous turns summarized...');
      const result = cm.prepareMessagesPayload(system, env, msgs);
      expect(result).toHaveLength(4);
      expect((result[2] as SystemMessage).content.toString()).toContain('HISTORICAL SUMMARY ANCHOR');
    });

    it('disabled config falls through to simple layout', () => {
      const cm = new ContextManager({ enabled: false });
      const result = cm.prepareMessagesPayload(system, env, msgs);
      expect(result).toHaveLength(2);
    });
  });

  describe('shouldCompact', () => {
    it('returns true at or above threshold ratio', () => {
      const cm = new ContextManager({ compactionThresholdRatio: 0.70 });
      expect(cm.shouldCompact(700, 1000)).toBe(true);
      expect(cm.shouldCompact(701, 1000)).toBe(true);
    });

    it('returns false below threshold ratio', () => {
      const cm = new ContextManager({ compactionThresholdRatio: 0.70 });
      expect(cm.shouldCompact(699, 1000)).toBe(false);
      expect(cm.shouldCompact(0, 1000)).toBe(false);
    });

    it('returns false when disabled', () => {
      const cm = new ContextManager({ enabled: false });
      expect(cm.shouldCompact(1000, 1000)).toBe(false);
    });

    it('returns false when auto compaction disabled', () => {
      const cm = new ContextManager({ enableAutoCompaction: false });
      expect(cm.shouldCompact(1000, 1000)).toBe(false);
    });
  });

  describe('applyCompaction', () => {
    it('sets summary anchor and slices last N turns', () => {
      const cm = new ContextManager({ keepLastTurnsCount: 2 });
      const msgs = [
        new HumanMessage('turn 1'),
        new HumanMessage('turn 2'),
        new HumanMessage('turn 3'),
      ];
      const result = cm.applyCompaction(msgs, 'summary text');
      expect(cm.getSummaryAnchor()).toBe('summary text');
      expect(result).toHaveLength(2);
      expect((result[0] as HumanMessage).content.toString()).toBe('turn 2');
      expect((result[1] as HumanMessage).content.toString()).toBe('turn 3');
    });
  });

  describe('getConfig', () => {
    it('returns a copy not the internal reference', () => {
      const cm = new ContextManager({ keepLastTurnsCount: 4 });
      const cfg = cm.getConfig();
      cfg.keepLastTurnsCount = 99;
      expect(cm.getConfig().keepLastTurnsCount).toBe(4);
    });
  });

  describe('estimateTokens', () => {
    it('returns sum of message content lengths divided by 4 (ceiled)', () => {
      const cm = new ContextManager();
      const msgs = [
        new SystemMessage('a'.repeat(10)),
        new HumanMessage('b'.repeat(6)),
      ];
      const tokens = cm.estimateTokens(msgs);
      expect(tokens).toBe(16);
    });

    it('returns 0 for empty messages', () => {
      const cm = new ContextManager();
      expect(cm.estimateTokens([])).toBe(0);
    });
  });

  describe('setSummaryAnchor / getSummaryAnchor', () => {
    it('set and get summary anchor', () => {
      const cm = new ContextManager();
      expect(cm.getSummaryAnchor()).toBeNull();
      cm.setSummaryAnchor('test summary');
      expect(cm.getSummaryAnchor()).toBe('test summary');
    });
  });
});
