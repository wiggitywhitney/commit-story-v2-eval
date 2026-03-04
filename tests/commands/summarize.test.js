// ABOUTME: Tests for summarize CLI command — date/week/month parsing, range expansion, and backfill orchestration
// ABOUTME: Verifies argument parsing, progress output, validation, --force, --weekly, and --monthly flag behavior

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock the summary graph (LLM calls)
const mockGenerateDailySummary = vi.fn();
const mockGenerateWeeklySummary = vi.fn();
const mockGenerateMonthlySummary = vi.fn();
vi.mock('../../src/generators/summary-graph.js', () => ({
  generateDailySummary: (...args) => mockGenerateDailySummary(...args),
  generateWeeklySummary: (...args) => mockGenerateWeeklySummary(...args),
  generateMonthlySummary: (...args) => mockGenerateMonthlySummary(...args),
}));

import {
  parseSummarizeArgs,
  expandDateRange,
  isValidWeekString,
  isValidMonthString,
  runSummarize,
  runWeeklySummarize,
  runMonthlySummarize,
} from '../../src/commands/summarize.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir;

function setupTmpDir() {
  tmpDir = mkdtempSync(join(tmpdir(), 'summarize-cmd-test-'));
}

function teardownTmpDir() {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true });
    tmpDir = null;
  }
}

function writeEntry(dateStr, content = '# Entry\n\nSome work done') {
  const [year, month] = dateStr.split('-');
  const dir = join(tmpDir, 'journal', 'entries', `${year}-${month}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${dateStr}.md`), content, 'utf-8');
}

function writeSummary(dateStr, content = '# Summary\n\nDaily summary') {
  const dir = join(tmpDir, 'journal', 'summaries', 'daily');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${dateStr}.md`), content, 'utf-8');
}

// ---------------------------------------------------------------------------
// parseSummarizeArgs
// ---------------------------------------------------------------------------

describe('parseSummarizeArgs', () => {
  it('parses a single date', () => {
    const result = parseSummarizeArgs(['2026-02-22']);
    expect(result).toEqual({
      dates: ['2026-02-22'],
      weeks: [],
      months: [],
      force: false,
      help: false,
      weekly: false,
      monthly: false,
      error: null,
    });
  });

  it('parses a date range with ..', () => {
    const result = parseSummarizeArgs(['2026-02-01..2026-02-05']);
    expect(result.dates).toEqual([
      '2026-02-01',
      '2026-02-02',
      '2026-02-03',
      '2026-02-04',
      '2026-02-05',
    ]);
    expect(result.force).toBe(false);
    expect(result.error).toBeNull();
  });

  it('normalizes reversed date ranges to ascending', () => {
    const result = parseSummarizeArgs(['2026-02-05..2026-02-01']);
    expect(result.dates).toEqual([
      '2026-02-01',
      '2026-02-02',
      '2026-02-03',
      '2026-02-04',
      '2026-02-05',
    ]);
  });

  it('parses --force flag', () => {
    const result = parseSummarizeArgs(['2026-02-22', '--force']);
    expect(result.force).toBe(true);
    expect(result.dates).toEqual(['2026-02-22']);
  });

  it('parses --help flag', () => {
    const result = parseSummarizeArgs(['--help']);
    expect(result.help).toBe(true);
  });

  it('returns error for missing date argument', () => {
    const result = parseSummarizeArgs([]);
    expect(result.error).toMatch(/date/i);
  });

  it('returns error for invalid date format', () => {
    const result = parseSummarizeArgs(['not-a-date']);
    expect(result.error).toMatch(/invalid/i);
  });

  it('returns error for invalid date in range', () => {
    const result = parseSummarizeArgs(['2026-02-01..bad']);
    expect(result.error).toMatch(/invalid/i);
  });

  it('handles range spanning month boundary', () => {
    const result = parseSummarizeArgs(['2026-01-30..2026-02-02']);
    expect(result.dates).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });

  it('handles single-day range', () => {
    const result = parseSummarizeArgs(['2026-02-15..2026-02-15']);
    expect(result.dates).toEqual(['2026-02-15']);
  });

  it('parses --weekly with week string', () => {
    const result = parseSummarizeArgs(['--weekly', '2026-W08']);
    expect(result.weekly).toBe(true);
    expect(result.weeks).toEqual(['2026-W08']);
    expect(result.dates).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('returns error for --weekly with invalid week format', () => {
    const result = parseSummarizeArgs(['--weekly', '2026-03']);
    expect(result.error).toMatch(/invalid week/i);
  });

  it('returns error for --weekly with no week argument', () => {
    const result = parseSummarizeArgs(['--weekly']);
    expect(result.error).toMatch(/missing week/i);
  });

  it('parses --weekly with --force', () => {
    const result = parseSummarizeArgs(['--weekly', '2026-W08', '--force']);
    expect(result.weekly).toBe(true);
    expect(result.force).toBe(true);
    expect(result.weeks).toEqual(['2026-W08']);
  });
});

// ---------------------------------------------------------------------------
// expandDateRange
// ---------------------------------------------------------------------------

describe('expandDateRange', () => {
  it('expands date range inclusive of endpoints', () => {
    const dates = expandDateRange('2026-03-01', '2026-03-03');
    expect(dates).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
  });

  it('returns single date for same start and end', () => {
    const dates = expandDateRange('2026-03-01', '2026-03-01');
    expect(dates).toEqual(['2026-03-01']);
  });

  it('handles month boundary crossing', () => {
    const dates = expandDateRange('2026-02-27', '2026-03-01');
    expect(dates).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });

  it('handles year boundary crossing', () => {
    const dates = expandDateRange('2025-12-30', '2026-01-02');
    expect(dates).toEqual([
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ]);
  });
});

// ---------------------------------------------------------------------------
// runSummarize (integration with real filesystem, mocked LLM)
// ---------------------------------------------------------------------------

describe('runSummarize', () => {
  beforeEach(() => {
    setupTmpDir();
    mockGenerateDailySummary.mockReset();
    mockGenerateDailySummary.mockResolvedValue({
      narrative: 'Worked on features.',
      keyDecisions: 'Chose approach A.',
      openThreads: 'Need to revisit B.',
      errors: [],
      generatedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    teardownTmpDir();
  });

  it('generates summary for a single date with entries', async () => {
    writeEntry('2026-02-22', '# Entry\n\nDid some work');

    const result = await runSummarize({
      dates: ['2026-02-22'],
      force: false,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual(['2026-02-22']);
    expect(result.noEntries).toEqual([]);
    expect(result.alreadyExists).toEqual([]);
    expect(result.failed).toEqual([]);

    const summaryPath = join(tmpDir, 'journal', 'summaries', 'daily', '2026-02-22.md');
    expect(existsSync(summaryPath)).toBe(true);
  });

  it('skips dates with no entries', async () => {
    // No entries written for this date
    const result = await runSummarize({
      dates: ['2026-02-22'],
      force: false,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual([]);
    expect(result.noEntries).toContain('2026-02-22');
  });

  it('skips dates with existing summaries (no --force)', async () => {
    writeEntry('2026-02-22', '# Entry\n\nDid work');
    writeSummary('2026-02-22');

    const result = await runSummarize({
      dates: ['2026-02-22'],
      force: false,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual([]);
    expect(result.alreadyExists).toContain('2026-02-22');
    expect(mockGenerateDailySummary).not.toHaveBeenCalled();
  });

  it('regenerates with --force even if summary exists', async () => {
    writeEntry('2026-02-22', '# Entry\n\nDid work');
    writeSummary('2026-02-22');

    const result = await runSummarize({
      dates: ['2026-02-22'],
      force: true,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual(['2026-02-22']);
    expect(mockGenerateDailySummary).toHaveBeenCalled();
  });

  it('processes multiple dates in a range', async () => {
    writeEntry('2026-02-01', '# Entry 1');
    writeEntry('2026-02-02', '# Entry 2');
    writeEntry('2026-02-03', '# Entry 3');

    const result = await runSummarize({
      dates: ['2026-02-01', '2026-02-02', '2026-02-03'],
      force: false,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual(['2026-02-01', '2026-02-02', '2026-02-03']);
    expect(mockGenerateDailySummary).toHaveBeenCalledTimes(3);
  });

  it('continues past failures and reports them', async () => {
    writeEntry('2026-02-01', '# Entry 1');
    writeEntry('2026-02-02', '# Entry 2');

    mockGenerateDailySummary
      .mockRejectedValueOnce(new Error('API timeout'))
      .mockResolvedValueOnce({
        narrative: 'Day 2 work.',
        keyDecisions: 'None.',
        openThreads: 'None.',
        errors: [],
        generatedAt: new Date().toISOString(),
      });

    const result = await runSummarize({
      dates: ['2026-02-01', '2026-02-02'],
      force: false,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual(['2026-02-02']);
    expect(result.failed).toEqual(['2026-02-01']);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('calls onProgress callback for each date', async () => {
    writeEntry('2026-02-01', '# Entry 1');
    writeEntry('2026-02-02', '# Entry 2');

    const progressMessages = [];
    await runSummarize({
      dates: ['2026-02-01', '2026-02-02'],
      force: false,
      basePath: tmpDir,
      onProgress: (msg) => progressMessages.push(msg),
    });

    expect(progressMessages.length).toBeGreaterThanOrEqual(2);
  });

  it('reports mixed results across a range', async () => {
    writeEntry('2026-02-01', '# Entry 1');
    // 2026-02-02 has no entries
    writeEntry('2026-02-03', '# Entry 3');
    writeSummary('2026-02-03'); // already exists

    const result = await runSummarize({
      dates: ['2026-02-01', '2026-02-02', '2026-02-03'],
      force: false,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual(['2026-02-01']);
    expect(result.noEntries).toContain('2026-02-02');
    expect(result.alreadyExists).toContain('2026-02-03');
  });
});

// ---------------------------------------------------------------------------
// isValidWeekString
// ---------------------------------------------------------------------------

describe('isValidWeekString', () => {
  it('accepts valid ISO week strings', () => {
    expect(isValidWeekString('2026-W01')).toBe(true);
    expect(isValidWeekString('2026-W08')).toBe(true);
    expect(isValidWeekString('2026-W52')).toBe(true);
    expect(isValidWeekString('2026-W53')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidWeekString('2026-03')).toBe(false);
    expect(isValidWeekString('2026-W0')).toBe(false);
    expect(isValidWeekString('W08')).toBe(false);
    expect(isValidWeekString('not-a-week')).toBe(false);
  });

  it('rejects week 0 and week 54+', () => {
    expect(isValidWeekString('2026-W00')).toBe(false);
    expect(isValidWeekString('2026-W54')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runWeeklySummarize (integration with real filesystem, mocked LLM)
// ---------------------------------------------------------------------------

describe('runWeeklySummarize', () => {
  beforeEach(() => {
    setupTmpDir();
    mockGenerateWeeklySummary.mockReset();
    mockGenerateWeeklySummary.mockResolvedValue({
      weekInReview: 'The week was productive.',
      highlights: '- Shipped feature A',
      patterns: '- Consistent refactoring',
      errors: [],
    });
  });

  afterEach(() => {
    teardownTmpDir();
  });

  it('generates weekly summary when daily summaries exist', async () => {
    // 2026-W10: March 2-8
    writeSummary('2026-03-02');
    writeSummary('2026-03-03');

    const result = await runWeeklySummarize({
      weeks: ['2026-W10'],
      force: false,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual(['2026-W10']);
    expect(result.noSummaries).toEqual([]);
    expect(result.failed).toEqual([]);

    const weeklyPath = join(tmpDir, 'journal', 'summaries', 'weekly', '2026-W10.md');
    expect(existsSync(weeklyPath)).toBe(true);
  });

  it('reports no-summaries when no daily summaries exist for the week', async () => {
    const result = await runWeeklySummarize({
      weeks: ['2026-W10'],
      force: false,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual([]);
    expect(result.noSummaries).toContain('2026-W10');
    expect(mockGenerateWeeklySummary).not.toHaveBeenCalled();
  });

  it('reports already-exists when weekly summary exists', async () => {
    writeSummary('2026-03-02');
    const weeklyDir = join(tmpDir, 'journal', 'summaries', 'weekly');
    mkdirSync(weeklyDir, { recursive: true });
    writeFileSync(join(weeklyDir, '2026-W10.md'), 'existing', 'utf-8');

    const result = await runWeeklySummarize({
      weeks: ['2026-W10'],
      force: false,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual([]);
    expect(result.alreadyExists).toContain('2026-W10');
    expect(mockGenerateWeeklySummary).not.toHaveBeenCalled();
  });

  it('regenerates with --force', async () => {
    writeSummary('2026-03-02');
    const weeklyDir = join(tmpDir, 'journal', 'summaries', 'weekly');
    mkdirSync(weeklyDir, { recursive: true });
    writeFileSync(join(weeklyDir, '2026-W10.md'), 'existing', 'utf-8');

    const result = await runWeeklySummarize({
      weeks: ['2026-W10'],
      force: true,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual(['2026-W10']);
    expect(mockGenerateWeeklySummary).toHaveBeenCalled();
  });

  it('calls onProgress callback', async () => {
    writeSummary('2026-03-02');

    const logs = [];
    await runWeeklySummarize({
      weeks: ['2026-W10'],
      force: false,
      basePath: tmpDir,
      onProgress: (msg) => logs.push(msg),
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('2026-W10');
  });
});

// ---------------------------------------------------------------------------
// parseSummarizeArgs — monthly mode
// ---------------------------------------------------------------------------

describe('parseSummarizeArgs monthly', () => {
  it('parses --monthly with month string', () => {
    const result = parseSummarizeArgs(['--monthly', '2026-02']);
    expect(result.monthly).toBe(true);
    expect(result.months).toEqual(['2026-02']);
    expect(result.dates).toEqual([]);
    expect(result.weeks).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('returns error for --monthly with invalid month format', () => {
    const result = parseSummarizeArgs(['--monthly', '2026-W08']);
    expect(result.error).toMatch(/invalid month/i);
  });

  it('returns error for --monthly with no month argument', () => {
    const result = parseSummarizeArgs(['--monthly']);
    expect(result.error).toMatch(/missing month/i);
  });

  it('parses --monthly with --force', () => {
    const result = parseSummarizeArgs(['--monthly', '2026-02', '--force']);
    expect(result.monthly).toBe(true);
    expect(result.force).toBe(true);
    expect(result.months).toEqual(['2026-02']);
  });
});

// ---------------------------------------------------------------------------
// isValidMonthString
// ---------------------------------------------------------------------------

describe('isValidMonthString', () => {
  it('accepts valid month strings', () => {
    expect(isValidMonthString('2026-01')).toBe(true);
    expect(isValidMonthString('2026-06')).toBe(true);
    expect(isValidMonthString('2026-12')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidMonthString('2026-1')).toBe(false);
    expect(isValidMonthString('2026')).toBe(false);
    expect(isValidMonthString('not-a-month')).toBe(false);
    expect(isValidMonthString('2026-W08')).toBe(false);
  });

  it('rejects month 0 and month 13+', () => {
    expect(isValidMonthString('2026-00')).toBe(false);
    expect(isValidMonthString('2026-13')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runMonthlySummarize (integration with real filesystem, mocked LLM)
// ---------------------------------------------------------------------------

function writeWeeklySummary(weekStr, content = '# Weekly\n\nWeekly summary') {
  const dir = join(tmpDir, 'journal', 'summaries', 'weekly');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${weekStr}.md`), content, 'utf-8');
}

describe('runMonthlySummarize', () => {
  beforeEach(() => {
    setupTmpDir();
    mockGenerateMonthlySummary.mockReset();
    mockGenerateMonthlySummary.mockResolvedValue({
      monthInReview: 'The month was productive.',
      accomplishments: '- Shipped feature A',
      growth: '- Learned new patterns',
      lookingAhead: '- Planning next month',
      errors: [],
    });
  });

  afterEach(() => {
    teardownTmpDir();
  });

  it('generates monthly summary when weekly summaries exist', async () => {
    // W06 (Feb 2-8) and W07 (Feb 9-15) are in February
    writeWeeklySummary('2026-W06');
    writeWeeklySummary('2026-W07');

    const result = await runMonthlySummarize({
      months: ['2026-02'],
      force: false,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual(['2026-02']);
    expect(result.noSummaries).toEqual([]);
    expect(result.failed).toEqual([]);

    const monthlyPath = join(tmpDir, 'journal', 'summaries', 'monthly', '2026-02.md');
    expect(existsSync(monthlyPath)).toBe(true);
  });

  it('reports no-summaries when no weekly summaries exist for the month', async () => {
    const result = await runMonthlySummarize({
      months: ['2026-02'],
      force: false,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual([]);
    expect(result.noSummaries).toContain('2026-02');
    expect(mockGenerateMonthlySummary).not.toHaveBeenCalled();
  });

  it('reports already-exists when monthly summary exists', async () => {
    writeWeeklySummary('2026-W06');
    const monthlyDir = join(tmpDir, 'journal', 'summaries', 'monthly');
    mkdirSync(monthlyDir, { recursive: true });
    writeFileSync(join(monthlyDir, '2026-02.md'), 'existing', 'utf-8');

    const result = await runMonthlySummarize({
      months: ['2026-02'],
      force: false,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual([]);
    expect(result.alreadyExists).toContain('2026-02');
    expect(mockGenerateMonthlySummary).not.toHaveBeenCalled();
  });

  it('regenerates with --force', async () => {
    writeWeeklySummary('2026-W06');
    const monthlyDir = join(tmpDir, 'journal', 'summaries', 'monthly');
    mkdirSync(monthlyDir, { recursive: true });
    writeFileSync(join(monthlyDir, '2026-02.md'), 'existing', 'utf-8');

    const result = await runMonthlySummarize({
      months: ['2026-02'],
      force: true,
      basePath: tmpDir,
    });

    expect(result.generated).toEqual(['2026-02']);
    expect(mockGenerateMonthlySummary).toHaveBeenCalled();
  });

  it('calls onProgress callback', async () => {
    writeWeeklySummary('2026-W06');

    const logs = [];
    await runMonthlySummarize({
      months: ['2026-02'],
      force: false,
      basePath: tmpDir,
      onProgress: (msg) => logs.push(msg),
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('2026-02');
  });
});
