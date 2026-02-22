import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  truncateDiff,
  truncateMessages,
  applyTokenBudget,
} from '../../../src/integrators/filters/token-filter.js';

/**
 * Helper: create a filtered message for token testing
 */
function _makeFilteredMessage({
  type = 'user',
  content = 'A test message',
  timestamp = '2026-02-21T10:00:00Z',
} = {}) {
  return { type, content, timestamp };
}

describe('estimateTokens', () => {
  it('returns 0 for null input', () => {
    expect(estimateTokens(null)).toBe(0);
  });

  it('returns 0 for undefined input', () => {
    expect(estimateTokens(undefined)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates tokens using 3.5 chars per token ratio', () => {
    // 35 chars / 3.5 = 10 tokens
    const text = 'a'.repeat(35);
    expect(estimateTokens(text)).toBe(10);
  });

  it('rounds up to nearest integer', () => {
    // 10 chars / 3.5 = 2.857... → ceil → 3
    const text = 'a'.repeat(10);
    expect(estimateTokens(text)).toBe(3);
  });

  it('handles single character', () => {
    // 1 / 3.5 = 0.285... → ceil → 1
    expect(estimateTokens('a')).toBe(1);
  });
});

describe('truncateDiff', () => {
  it('returns empty diff for null input', () => {
    const result = truncateDiff(null, 1000);

    expect(result.diff).toBe('');
    expect(result.truncated).toBe(false);
    expect(result.originalTokens).toBe(0);
  });

  it('returns empty diff for empty string', () => {
    const result = truncateDiff('', 1000);

    expect(result.diff).toBe('');
    expect(result.truncated).toBe(false);
  });

  it('does not truncate when under budget', () => {
    const diff = 'diff --git a/file.js b/file.js\n+console.log("hello");';
    const result = truncateDiff(diff, 1000);

    expect(result.diff).toBe(diff);
    expect(result.truncated).toBe(false);
  });

  it('truncates when over budget', () => {
    // Create a diff that's way over budget (budget = 5 tokens ≈ 17 chars)
    const diff = 'diff --git a/file.js b/file.js\n' + '+'.repeat(200);
    const result = truncateDiff(diff, 5);

    expect(result.truncated).toBe(true);
    expect(result.diff.length).toBeLessThan(diff.length);
    expect(result.diff).toContain('[DIFF TRUNCATED');
  });

  it('tries to truncate at file boundaries', () => {
    const file1 = 'diff --git a/first.js b/first.js\n+first file content here';
    const file2 = 'diff --git a/second.js b/second.js\n+second file content';
    const file3 = 'diff --git a/third.js b/third.js\n+third file content plus extra padding here';
    const diff = file1 + '\n' + file2 + '\n' + file3;

    // Budget enough for ~2 files but not all 3
    const tokensFor2Files = estimateTokens(file1 + '\n' + file2);
    const result = truncateDiff(diff, tokensFor2Files + 5);

    expect(result.truncated).toBe(true);
    // Should keep complete file sections rather than cutting mid-file
    expect(result.diff).toContain('first.js');
  });

  it('includes original and shown token counts in truncation message', () => {
    const diff = 'diff --git a/file.js b/file.js\n' + '+'.repeat(500);
    const result = truncateDiff(diff, 10);

    expect(result.truncated).toBe(true);
    expect(result.originalTokens).toBeGreaterThan(10);
    expect(result.shownTokens).toBeDefined();
  });
});

describe('truncateMessages', () => {
  it('returns empty array for null input', () => {
    const result = truncateMessages(null, 1000);

    expect(result.messages).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.originalCount).toBe(0);
  });

  it('returns empty array for empty input', () => {
    const result = truncateMessages([], 1000);

    expect(result.messages).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it('does not truncate when under budget', () => {
    const messages = [
      _makeFilteredMessage({ content: 'Short message' }),
    ];
    const result = truncateMessages(messages, 10000);

    expect(result.messages).toEqual(messages);
    expect(result.truncated).toBe(false);
  });

  it('removes oldest messages first when over budget', () => {
    const messages = [
      _makeFilteredMessage({ content: 'Old message ' + 'x'.repeat(100), timestamp: '2026-02-21T09:00:00Z' }),
      _makeFilteredMessage({ content: 'Middle message ' + 'x'.repeat(100), timestamp: '2026-02-21T10:00:00Z' }),
      _makeFilteredMessage({ content: 'Recent message ' + 'x'.repeat(100), timestamp: '2026-02-21T11:00:00Z' }),
    ];

    // Budget enough for roughly 1 message
    const result = truncateMessages(messages, 40);

    expect(result.truncated).toBe(true);
    expect(result.messages.length).toBeLessThan(3);
    // Most recent message should be preserved
    expect(result.messages[result.messages.length - 1].content).toContain('Recent message');
  });

  it('preserves at least one message', () => {
    const messages = [
      _makeFilteredMessage({ content: 'x'.repeat(1000) }),
    ];
    // Budget of 1 token — way too small for the message
    const result = truncateMessages(messages, 1);

    expect(result.messages).toHaveLength(1);
  });

  it('tracks original and preserved counts', () => {
    const messages = [
      _makeFilteredMessage({ content: 'msg1 ' + 'x'.repeat(100) }),
      _makeFilteredMessage({ content: 'msg2 ' + 'x'.repeat(100) }),
      _makeFilteredMessage({ content: 'msg3 ' + 'x'.repeat(100) }),
    ];
    const result = truncateMessages(messages, 40);

    expect(result.truncated).toBe(true);
    expect(result.originalCount).toBe(3);
    expect(result.preservedCount).toBeLessThan(3);
  });
});

describe('applyTokenBudget', () => {
  /**
   * Helper: create a minimal context object for budget testing
   */
  function _makeContext({
    diff = 'diff --git a/file.js b/file.js\n+hello',
    messages = [],
  } = {}) {
    return {
      commit: {
        hash: 'abc123def456',
        shortHash: 'abc123d',
        message: 'test commit',
        subject: 'test commit',
        author: 'Test User',
        authorEmail: 'test@example.com',
        timestamp: new Date('2026-02-21T10:00:00Z'),
        diff,
        isMerge: false,
        parentCount: 1,
      },
      chat: {
        messages,
        sessions: new Map(),
        messageCount: messages.length,
        sessionCount: 0,
      },
      metadata: {
        previousCommitTime: new Date('2026-02-21T09:00:00Z'),
        timeWindow: {
          start: new Date('2026-02-21T09:00:00Z'),
          end: new Date('2026-02-21T10:00:00Z'),
        },
        filterStats: {
          totalMessages: 0,
          filteredMessages: 0,
          preservedMessages: 0,
          substantialUserMessages: 0,
          filterReasons: {},
        },
        tokenEstimate: 0,
      },
    };
  }

  it('preserves context when under budget', () => {
    const context = _makeContext();
    const result = applyTokenBudget(context);

    expect(result.commit.diff).toBe(context.commit.diff);
    expect(result.metadata.tokenBudget.diffTruncated).toBe(false);
    expect(result.metadata.tokenBudget.messagesTruncated).toBe(false);
  });

  it('records token budget settings in metadata', () => {
    const context = _makeContext();
    const result = applyTokenBudget(context, {
      totalBudget: 100000,
      diffBudget: 30000,
      chatBudget: 50000,
    });

    expect(result.metadata.tokenBudget.total).toBe(100000);
    expect(result.metadata.tokenBudget.diffBudget).toBe(30000);
    expect(result.metadata.tokenBudget.chatBudget).toBe(50000);
  });

  it('truncates large diff to fit diff budget', () => {
    const largeDiff = 'diff --git a/file.js b/file.js\n' + '+'.repeat(500000);
    const context = _makeContext({ diff: largeDiff });
    const result = applyTokenBudget(context, { diffBudget: 100 });

    expect(result.metadata.tokenBudget.diffTruncated).toBe(true);
    expect(result.commit.diff.length).toBeLessThan(largeDiff.length);
  });

  it('truncates messages to fit chat budget', () => {
    const messages = Array.from({ length: 20 }, (_, i) =>
      _makeFilteredMessage({ content: `Message ${i} ` + 'x'.repeat(200) })
    );
    const context = _makeContext({ messages });
    const result = applyTokenBudget(context, { chatBudget: 100 });

    expect(result.metadata.tokenBudget.messagesTruncated).toBe(true);
    expect(result.chat.messages.length).toBeLessThan(20);
  });

  it('calculates total token estimate', () => {
    const context = _makeContext({
      diff: 'small diff',
      messages: [_makeFilteredMessage({ content: 'a message' })],
    });
    const result = applyTokenBudget(context);

    expect(result.metadata.tokenEstimate).toBeGreaterThan(0);
  });

  it('uses default budgets when options not provided', () => {
    const context = _makeContext();
    const result = applyTokenBudget(context);

    expect(result.metadata.tokenBudget.total).toBe(150000);
    expect(result.metadata.tokenBudget.diffBudget).toBe(50000);
    expect(result.metadata.tokenBudget.chatBudget).toBe(80000);
  });

  it('enforces totalBudget by further truncating messages when diff + chat exceed total', () => {
    // Diff ~866 tokens (fits in diffBudget=1000)
    // Chat ~1500 tokens (fits in chatBudget=5000)
    // Combined ~2400 tokens > totalBudget=1500
    // remainingBudget = 1500 - ~30 (meta) - ~866 (diff) ≈ 604 > 0
    // So further truncation of messages should trigger
    const largeDiff = 'diff --git a/file.js b/file.js\n' + '+'.repeat(3000);
    const messages = Array.from({ length: 10 }, (_, i) =>
      _makeFilteredMessage({ content: `Message ${i} ` + 'x'.repeat(500) })
    );
    const context = _makeContext({ diff: largeDiff, messages });

    const result = applyTokenBudget(context, {
      totalBudget: 1500,
      diffBudget: 1000,
      chatBudget: 5000,
    });

    expect(result.metadata.tokenBudget.messagesTruncated).toBe(true);
    expect(result.chat.messages.length).toBeLessThan(10);
    expect(result.metadata.tokenEstimate).toBeDefined();
  });
});
