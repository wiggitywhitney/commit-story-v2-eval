// ABOUTME: Tests for summarize CLI command — date parsing, range expansion, and backfill orchestration
// ABOUTME: Verifies argument parsing, progress output, validation, and --force flag behavior

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock the summary graph (LLM calls)
const mockGenerateDailySummary = vi.fn();
vi.mock('../../src/generators/summary-graph.js', () => ({
  generateDailySummary: (...args) => mockGenerateDailySummary(...args),
}));

import {
  parseSummarizeArgs,
  expandDateRange,
  runSummarize,
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
      force: false,
      help: false,
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
