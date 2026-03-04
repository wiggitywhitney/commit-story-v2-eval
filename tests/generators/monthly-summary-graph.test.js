// ABOUTME: Tests for monthly summary generation in summary-graph.js
// ABOUTME: Contract tests mock ChatAnthropic; unit tests cover deterministic helpers

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the LLM provider before importing the module under test.
const mockInvoke = vi.fn();
vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: class MockChatAnthropic {
    invoke(...args) {
      return mockInvoke(...args);
    }
  },
}));

import {
  generateMonthlySummary,
  monthlySummaryNode,
  formatWeeklySummariesForMonthly,
  cleanMonthlySummaryOutput,
  resetModel,
  MonthlySummaryState,
} from '../../src/generators/summary-graph.js';

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function _makeWeeklySummaries(count = 4) {
  const summaries = [];
  for (let i = 0; i < count; i++) {
    const week = String(i + 1).padStart(2, '0');
    summaries.push({
      weekLabel: `2026-W${week}`,
      content: `# Weekly Summary — 2026-W${week}

## Week in Review

The developer worked on feature set ${i} this week. It involved refactoring and adding tests.

## Highlights

- Shipped feature ${i}
- Fixed critical bug in module ${i}

## Patterns

- Recurring theme of test-first development`,
    });
  }
  return summaries;
}

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------

describe('formatWeeklySummariesForMonthly', () => {
  it('joins weekly summaries with separator and adds count header', () => {
    const summaries = _makeWeeklySummaries(3);
    const result = formatWeeklySummariesForMonthly(summaries);

    expect(result).toContain('3 weekly summaries');
    expect(result).toContain('Week 1 of 3: 2026-W01');
    expect(result).toContain('Week 2 of 3: 2026-W02');
    expect(result).toContain('Week 3 of 3: 2026-W03');
    expect(result).toContain('feature set 0');
    expect(result).toContain('feature set 2');
  });

  it('handles single weekly summary', () => {
    const summaries = _makeWeeklySummaries(1);
    const result = formatWeeklySummariesForMonthly(summaries);

    expect(result).toContain('1 weekly summary');
    expect(result).toContain('Week 1 of 1');
  });

  it('returns empty message for no summaries', () => {
    const result = formatWeeklySummariesForMonthly([]);
    expect(result).toContain('No weekly summaries');
  });

  it('returns empty message for null input', () => {
    const result = formatWeeklySummariesForMonthly(null);
    expect(result).toContain('No weekly summaries');
  });
});

describe('cleanMonthlySummaryOutput', () => {
  it('returns output when it contains all four sections', () => {
    const output = `## Month in Review

The developer focused on infrastructure all month.

## Accomplishments

- Shipped the new deployment pipeline

## Growth

- Learned Kubernetes operator patterns

## Looking Ahead

- Need to tackle monitoring next month`;

    expect(cleanMonthlySummaryOutput(output)).toBe(output);
  });

  it('strips preamble before ## Month in Review', () => {
    const output = `Here's a summary of the month:

## Month in Review

The developer focused on infrastructure all month.

## Accomplishments

- Shipped the new deployment pipeline

## Growth

No notable growth signals this month.

## Looking Ahead

No open threads carrying into next month.`;

    const cleaned = cleanMonthlySummaryOutput(output);
    expect(cleaned).toMatch(/^## Month in Review/);
    expect(cleaned).not.toContain("Here's a summary");
  });

  it('replaces banned words', () => {
    const output = `## Month in Review

The developer implemented a comprehensive and robust solution leveraging advanced patterns.

## Accomplishments

No standout accomplishments this month.

## Growth

No notable growth signals this month.

## Looking Ahead

No open threads carrying into next month.`;

    const cleaned = cleanMonthlySummaryOutput(output);
    expect(cleaned).not.toMatch(/comprehensive/i);
    expect(cleaned).not.toMatch(/robust/i);
    expect(cleaned).not.toMatch(/leveraging/i);
  });

  it('returns null/empty input as-is', () => {
    expect(cleanMonthlySummaryOutput(null)).toBeNull();
    expect(cleanMonthlySummaryOutput('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// LLM boundary (node) tests
// ---------------------------------------------------------------------------

describe('monthlySummaryNode', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    resetModel();
  });

  it('sends weekly summaries to LLM and returns parsed sections', async () => {
    const llmOutput = `## Month in Review

The developer spent February rebuilding the auth system and deploying it to production.

## Accomplishments

- Shipped JWT-based authentication to production
- Completed database migration to PostgreSQL
- Added comprehensive test coverage

## Growth

- Gained deep understanding of OAuth2 flows
- Refined TDD workflow for complex integrations

## Looking Ahead

- Need to implement refresh token rotation
- Performance testing planned for next month`;

    mockInvoke.mockResolvedValue({ content: llmOutput });

    const weeklySummaries = _makeWeeklySummaries(4);
    const result = await monthlySummaryNode({ weeklySummaries, monthLabel: '2026-02' });

    expect(result.monthInReview).toContain('auth system');
    expect(result.accomplishments).toContain('JWT');
    expect(result.growth).toContain('OAuth2');
    expect(result.lookingAhead).toContain('refresh token');
    expect(result.errors).toEqual([]);

    // Verify LLM was called with system + human messages
    expect(mockInvoke).toHaveBeenCalledOnce();
    const [messages] = mockInvoke.mock.calls[0];
    expect(messages).toHaveLength(2);
  });

  it('returns early with message when no weekly summaries provided', async () => {
    const result = await monthlySummaryNode({ weeklySummaries: [], monthLabel: '2026-02' });

    expect(result.monthInReview).toContain('No weekly summaries');
    expect(result.accomplishments).toBe('');
    expect(result.growth).toBe('');
    expect(result.lookingAhead).toBe('');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('returns early for null weekly summaries', async () => {
    const result = await monthlySummaryNode({ weeklySummaries: null, monthLabel: '2026-02' });

    expect(result.monthInReview).toContain('No weekly summaries');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('handles LLM errors gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('API rate limited'));

    const weeklySummaries = _makeWeeklySummaries(1);
    const result = await monthlySummaryNode({ weeklySummaries, monthLabel: '2026-02' });

    expect(result.monthInReview).toContain('failed');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('rate limited');
  });

  it('handles LLM output missing sections', async () => {
    mockInvoke.mockResolvedValue({ content: 'Just some text without proper sections' });

    const weeklySummaries = _makeWeeklySummaries(2);
    const result = await monthlySummaryNode({ weeklySummaries, monthLabel: '2026-02' });

    // Should still return something without crashing
    expect(result).toHaveProperty('monthInReview');
    expect(result).toHaveProperty('accomplishments');
    expect(result).toHaveProperty('growth');
    expect(result).toHaveProperty('lookingAhead');
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// End-to-end (graph execution)
// ---------------------------------------------------------------------------

describe('generateMonthlySummary', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    resetModel();
  });

  it('generates a monthly summary from weekly summaries', async () => {
    const llmOutput = `## Month in Review

The developer focused on the summary pipeline all month, building daily, weekly, and monthly generation.

## Accomplishments

- Daily summary generation working end to end
- Weekly rollups consolidate daily narratives
- Gap detection handles irregular schedules

## Growth

- Deeper understanding of LangGraph state management
- Refined prompt engineering for narrative synthesis

## Looking Ahead

- Monthly summaries still needed
- Documentation pass planned`;

    mockInvoke.mockResolvedValue({ content: llmOutput });

    const weeklySummaries = _makeWeeklySummaries(4);
    const result = await generateMonthlySummary(weeklySummaries, '2026-02');

    expect(result.monthInReview).toContain('summary pipeline');
    expect(result.accomplishments).toContain('Gap detection');
    expect(result.growth).toContain('LangGraph');
    expect(result.lookingAhead).toContain('Documentation');
    expect(result.errors).toEqual([]);
    expect(result.generatedAt).toBeInstanceOf(Date);
  });
});
