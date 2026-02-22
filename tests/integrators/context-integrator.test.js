import { describe, it, expect } from 'vitest';
import { formatContextForPrompt, getContextSummary } from '../../src/integrators/context-integrator.js';

/**
 * Helper: create a minimal context object
 */
function _makeContext({
  shortHash = 'abc123d',
  author = 'Test User',
  timestamp = new Date('2026-02-21T10:15:32Z'),
  message = 'feat: add feature',
  subject = 'feat: add feature',
  diff = 'diff --git a/file.js b/file.js\n+console.log("hello");',
  isMerge = false,
  parentCount = 1,
  messages = [],
  sessionCount = 0,
} = {}) {
  return {
    commit: {
      hash: 'abc123def456789',
      shortHash,
      message,
      subject,
      author,
      authorEmail: 'test@example.com',
      timestamp,
      diff,
      isMerge,
      parentCount,
    },
    chat: {
      messages,
      sessions: new Map(),
      messageCount: messages.length,
      sessionCount,
    },
    metadata: {
      previousCommitTime: new Date('2026-02-21T09:00:00Z'),
      timeWindow: {
        start: new Date('2026-02-21T09:00:00Z'),
        end: timestamp,
      },
      filterStats: {
        totalMessages: 10,
        filteredMessages: 7,
        preservedMessages: 3,
        substantialUserMessages: 1,
        filterReasons: { toolUse: 5, tooShort: 2 },
      },
      tokenEstimate: 5000,
      tokenBudget: { total: 150000 },
      sensitiveDataFilter: { totalRedactions: 0 },
    },
  };
}

describe('formatContextForPrompt', () => {
  it('includes commit information section', () => {
    const context = _makeContext();
    const result = formatContextForPrompt(context);

    expect(result).toContain('## Commit Information');
    expect(result).toContain('**Hash**: abc123d');
    expect(result).toContain('**Author**: Test User');
    expect(result).toContain('**Message**: feat: add feature');
  });

  it('includes commit date as ISO string', () => {
    const context = _makeContext({ timestamp: new Date('2026-02-21T10:15:32Z') });
    const result = formatContextForPrompt(context);

    expect(result).toContain('**Date**: 2026-02-21T10:15:32.000Z');
  });

  it('includes merge commit info when isMerge is true', () => {
    const context = _makeContext({ isMerge: true, parentCount: 2 });
    const result = formatContextForPrompt(context);

    expect(result).toContain('**Merge Commit**: Yes (2 parents)');
  });

  it('excludes merge commit info when isMerge is false', () => {
    const context = _makeContext({ isMerge: false });
    const result = formatContextForPrompt(context);

    expect(result).not.toContain('**Merge Commit**');
  });

  it('includes code changes section with diff', () => {
    const context = _makeContext({ diff: '+console.log("hello");' });
    const result = formatContextForPrompt(context);

    expect(result).toContain('## Code Changes');
    expect(result).toContain('```diff');
    expect(result).toContain('+console.log("hello");');
    expect(result).toContain('```');
  });

  it('shows placeholder when no diff', () => {
    const context = _makeContext({ diff: '' });
    const result = formatContextForPrompt(context);

    expect(result).toContain('*No code changes in this commit*');
  });

  it('includes development conversation section with messages', () => {
    const messages = [
      { type: 'user', timestamp: '2026-02-21T10:00:00Z', content: 'Can you add tests?' },
      { type: 'assistant', timestamp: '2026-02-21T10:01:00Z', content: 'Sure, I will add tests.' },
    ];
    const context = _makeContext({ messages, sessionCount: 1 });
    const result = formatContextForPrompt(context);

    expect(result).toContain('## Development Conversation');
    expect(result).toContain('*2 messages from 1 session(s)*');
    expect(result).toContain('**Human**');
    expect(result).toContain('Can you add tests?');
    expect(result).toContain('**Assistant**');
    expect(result).toContain('Sure, I will add tests.');
  });

  it('shows placeholder when no messages', () => {
    const context = _makeContext({ messages: [] });
    const result = formatContextForPrompt(context);

    expect(result).toContain('*No conversation captured for this time window*');
  });
});

describe('getContextSummary', () => {
  it('returns commit summary fields', () => {
    const context = _makeContext();
    const summary = getContextSummary(context);

    expect(summary.commit.hash).toBe('abc123d');
    expect(summary.commit.author).toBe('Test User');
    expect(summary.commit.isMerge).toBe(false);
  });

  it('includes commit timestamp as ISO string', () => {
    const context = _makeContext({ timestamp: new Date('2026-02-21T10:15:32Z') });
    const summary = getContextSummary(context);

    expect(summary.commit.timestamp).toBe('2026-02-21T10:15:32.000Z');
  });

  it('includes diff length', () => {
    const context = _makeContext({ diff: 'x'.repeat(500) });
    const summary = getContextSummary(context);

    expect(summary.commit.diffLength).toBe(500);
  });

  it('returns 0 for null diff', () => {
    const context = _makeContext({ diff: null });
    const summary = getContextSummary(context);

    expect(summary.commit.diffLength).toBe(0);
  });

  it('includes chat stats', () => {
    const messages = [
      { type: 'user', timestamp: 'ts', content: 'msg1' },
      { type: 'assistant', timestamp: 'ts', content: 'msg2' },
    ];
    const context = _makeContext({ messages, sessionCount: 1 });
    const summary = getContextSummary(context);

    expect(summary.chat.messageCount).toBe(2);
    expect(summary.chat.sessionCount).toBe(1);
  });

  it('includes metadata stats', () => {
    const context = _makeContext();
    const summary = getContextSummary(context);

    expect(summary.metadata.tokenEstimate).toBe(5000);
    expect(summary.metadata.filterStats).toBeDefined();
    expect(summary.metadata.tokenBudget).toBeDefined();
    expect(summary.metadata.sensitiveDataFilter).toBeDefined();
  });
});
