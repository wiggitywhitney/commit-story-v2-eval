// ABOUTME: Tests for auto-summarize.js — auto-trigger logic for daily, weekly, and monthly summaries
// ABOUTME: Verifies gap detection integration and summary generation orchestration

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

import { triggerAutoSummaries, triggerAutoWeeklySummaries, triggerAutoMonthlySummaries } from '../../src/managers/auto-summarize.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir;

function setupTmpDir() {
  tmpDir = mkdtempSync(join(tmpdir(), 'auto-summarize-test-'));
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

function writeWeeklySummary(weekStr, content = '# Weekly\n\nWeekly summary') {
  const dir = join(tmpDir, 'journal', 'summaries', 'weekly');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${weekStr}.md`), content, 'utf-8');
}

function writeMonthlySummary(monthStr, content = '# Monthly\n\nMonthly summary') {
  const dir = join(tmpDir, 'journal', 'summaries', 'monthly');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${monthStr}.md`), content, 'utf-8');
}

// ---------------------------------------------------------------------------
// triggerAutoSummaries
// ---------------------------------------------------------------------------

describe('triggerAutoSummaries', () => {
  beforeEach(() => {
    setupTmpDir();
    mockGenerateDailySummary.mockReset();
    mockGenerateWeeklySummary.mockReset();
    mockGenerateMonthlySummary.mockReset();
    mockGenerateDailySummary.mockResolvedValue({
      narrative: 'Summary narrative',
      keyDecisions: 'Some decisions',
      openThreads: 'Some threads',
      errors: [],
    });
    mockGenerateWeeklySummary.mockResolvedValue({
      weekInReview: 'Week narrative',
      highlights: 'Some highlights',
      patterns: 'Some patterns',
      errors: [],
    });
    mockGenerateMonthlySummary.mockResolvedValue({
      monthInReview: 'Month narrative',
      accomplishments: 'Some accomplishments',
      growth: 'Some growth',
      lookingAhead: 'Some threads',
      errors: [],
    });
  });

  afterEach(teardownTmpDir);

  it('returns empty results when no unsummarized days exist', async () => {
    const result = await triggerAutoSummaries(tmpDir);
    expect(result.generated).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('generates summaries for unsummarized past days', async () => {
    writeEntry('2026-01-10');
    writeEntry('2026-01-11');

    const result = await triggerAutoSummaries(tmpDir);

    // Daily summaries generated, plus weekly may also generate
    const dailyGenerated = result.generated.filter(p => p.includes('daily'));
    expect(dailyGenerated).toHaveLength(2);
    expect(dailyGenerated[0]).toContain('2026-01-10');
    expect(dailyGenerated[1]).toContain('2026-01-11');
    expect(mockGenerateDailySummary).toHaveBeenCalledTimes(2);
  });

  it('skips days that already have summaries', async () => {
    writeEntry('2026-01-10');
    writeEntry('2026-01-11');
    writeSummary('2026-01-10');

    const result = await triggerAutoSummaries(tmpDir);

    // Daily: only 2026-01-11 generated. Weekly may also generate.
    const dailyGenerated = result.generated.filter(p => p.includes('daily'));
    expect(dailyGenerated).toHaveLength(1);
    expect(dailyGenerated[0]).toContain('2026-01-11');
    expect(mockGenerateDailySummary).toHaveBeenCalledTimes(1);
  });

  it('does not generate summary for today', async () => {
    const today = new Date().toISOString().slice(0, 10);
    writeEntry(today);

    const result = await triggerAutoSummaries(tmpDir);

    expect(result.generated).toEqual([]);
    expect(mockGenerateDailySummary).not.toHaveBeenCalled();
  });

  it('creates summary files on disk', async () => {
    writeEntry('2026-01-15');

    await triggerAutoSummaries(tmpDir);

    const summaryPath = join(tmpDir, 'journal', 'summaries', 'daily', '2026-01-15.md');
    expect(existsSync(summaryPath)).toBe(true);
  });

  it('records errors from generation without stopping', async () => {
    writeEntry('2026-01-10');
    writeEntry('2026-01-11');
    mockGenerateDailySummary
      .mockResolvedValueOnce({
        narrative: 'OK',
        keyDecisions: '',
        openThreads: '',
        errors: ['LLM timeout on key decisions'],
      })
      .mockResolvedValueOnce({
        narrative: 'Also OK',
        keyDecisions: '',
        openThreads: '',
        errors: [],
      });

    const result = await triggerAutoSummaries(tmpDir);

    // At least 2 daily generated (weekly may also be included)
    const dailyGenerated = result.generated.filter(p => p.includes('daily'));
    expect(dailyGenerated).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('2026-01-10');
  });

  it('continues generating remaining days when one fails', async () => {
    writeEntry('2026-01-10');
    writeEntry('2026-01-11');
    mockGenerateDailySummary
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({
        narrative: 'Second day OK',
        keyDecisions: '',
        openThreads: '',
        errors: [],
      });

    const result = await triggerAutoSummaries(tmpDir);

    // First day failed, second succeeded. Weekly may also generate.
    const dailyGenerated = result.generated.filter(p => p.includes('daily'));
    expect(dailyGenerated).toHaveLength(1);
    expect(dailyGenerated[0]).toContain('2026-01-11');
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toContain('2026-01-10');
  });

  it('logs progress for each day being summarized', async () => {
    writeEntry('2026-01-10');
    writeEntry('2026-01-11');

    const logs = [];
    const onProgress = (msg) => logs.push(msg);

    await triggerAutoSummaries(tmpDir, { onProgress });

    // Daily + weekly progress messages
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs[0]).toContain('2026-01-10');
    expect(logs[1]).toContain('2026-01-11');
  });

  it('triggers weekly summaries after daily summaries', async () => {
    // Write entries for past days in week 2026-W02 (Jan 5-11)
    writeEntry('2026-01-05');
    writeEntry('2026-01-06');

    const result = await triggerAutoSummaries(tmpDir);

    // Should have generated both daily and weekly summaries
    expect(result.generated.length).toBeGreaterThanOrEqual(2);
    // Weekly summary for W02 should have been generated
    const weeklyPath = join(tmpDir, 'journal', 'summaries', 'weekly', '2026-W02.md');
    expect(existsSync(weeklyPath)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// triggerAutoWeeklySummaries
// ---------------------------------------------------------------------------

describe('triggerAutoWeeklySummaries', () => {
  beforeEach(() => {
    setupTmpDir();
    mockGenerateWeeklySummary.mockReset();
    mockGenerateWeeklySummary.mockResolvedValue({
      weekInReview: 'Week narrative',
      highlights: 'Some highlights',
      patterns: 'Some patterns',
      errors: [],
    });
  });

  afterEach(teardownTmpDir);

  it('returns empty results when no daily summaries exist', async () => {
    const result = await triggerAutoWeeklySummaries(tmpDir);
    expect(result.generated).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('generates weekly summary for past weeks with daily summaries', async () => {
    // Week 2026-W02: Jan 5-11
    writeSummary('2026-01-05');
    writeSummary('2026-01-06');

    const result = await triggerAutoWeeklySummaries(tmpDir);

    expect(result.generated).toHaveLength(1);
    expect(result.generated[0]).toContain('2026-W02');
  });

  it('skips weeks that already have weekly summaries', async () => {
    writeSummary('2026-01-05'); // W02
    writeSummary('2026-01-12'); // W03
    writeWeeklySummary('2026-W02');

    const result = await triggerAutoWeeklySummaries(tmpDir);

    // Only W03 should be generated, not W02
    const generatedWeeks = result.generated.filter(p => p.includes('W02'));
    expect(generatedWeeks).toHaveLength(0);
    const generatedW03 = result.generated.filter(p => p.includes('W03'));
    expect(generatedW03).toHaveLength(1);
  });

  it('continues past failures', async () => {
    writeSummary('2026-01-05'); // W02
    writeSummary('2026-01-12'); // W03

    mockGenerateWeeklySummary
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({
        weekInReview: 'OK',
        highlights: '',
        patterns: '',
        errors: [],
      });

    const result = await triggerAutoWeeklySummaries(tmpDir);

    expect(result.failed).toHaveLength(1);
    expect(result.generated).toHaveLength(1);
  });

  it('logs progress for weekly summaries', async () => {
    writeSummary('2026-01-05'); // W02

    const logs = [];
    const result = await triggerAutoWeeklySummaries(tmpDir, {
      onProgress: (msg) => logs.push(msg),
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('weekly');
    expect(logs[0]).toContain('2026-W02');
  });
});

// ---------------------------------------------------------------------------
// triggerAutoMonthlySummaries
// ---------------------------------------------------------------------------

describe('triggerAutoMonthlySummaries', () => {
  beforeEach(() => {
    setupTmpDir();
    mockGenerateMonthlySummary.mockReset();
    mockGenerateMonthlySummary.mockResolvedValue({
      monthInReview: 'Month narrative',
      accomplishments: 'Some accomplishments',
      growth: 'Some growth',
      lookingAhead: 'Some threads',
      errors: [],
    });
  });

  afterEach(teardownTmpDir);

  it('returns empty results when no weekly summaries exist', async () => {
    const result = await triggerAutoMonthlySummaries(tmpDir);
    expect(result.generated).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('generates monthly summary for past months with weekly summaries', async () => {
    // W02 (Jan 5-11) is in January 2026
    writeWeeklySummary('2026-W02');
    writeWeeklySummary('2026-W03');

    const result = await triggerAutoMonthlySummaries(tmpDir);

    expect(result.generated).toHaveLength(1);
    expect(result.generated[0]).toContain('2026-01');
  });

  it('skips months that already have monthly summaries', async () => {
    writeWeeklySummary('2026-W02'); // January
    writeWeeklySummary('2026-W06'); // February
    writeMonthlySummary('2026-01');

    const result = await triggerAutoMonthlySummaries(tmpDir);

    const janGenerated = result.generated.filter(p => p.includes('2026-01'));
    expect(janGenerated).toHaveLength(0);
    const febGenerated = result.generated.filter(p => p.includes('2026-02'));
    expect(febGenerated).toHaveLength(1);
  });

  it('continues past failures', async () => {
    writeWeeklySummary('2026-W02'); // January
    writeWeeklySummary('2026-W06'); // February

    mockGenerateMonthlySummary
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({
        monthInReview: 'OK',
        accomplishments: '',
        growth: '',
        lookingAhead: '',
        errors: [],
      });

    const result = await triggerAutoMonthlySummaries(tmpDir);

    expect(result.failed).toHaveLength(1);
    expect(result.generated).toHaveLength(1);
  });

  it('logs progress for monthly summaries', async () => {
    writeWeeklySummary('2026-W02'); // January

    const logs = [];
    await triggerAutoMonthlySummaries(tmpDir, {
      onProgress: (msg) => logs.push(msg),
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('monthly');
    expect(logs[0]).toContain('2026-01');
  });
});

// ---------------------------------------------------------------------------
// triggerAutoSummaries chains daily → weekly → monthly
// ---------------------------------------------------------------------------

describe('triggerAutoSummaries monthly chaining', () => {
  beforeEach(() => {
    setupTmpDir();
    mockGenerateDailySummary.mockReset();
    mockGenerateWeeklySummary.mockReset();
    mockGenerateMonthlySummary.mockReset();
    mockGenerateDailySummary.mockResolvedValue({
      narrative: 'Summary narrative',
      keyDecisions: 'Some decisions',
      openThreads: 'Some threads',
      errors: [],
    });
    mockGenerateWeeklySummary.mockResolvedValue({
      weekInReview: 'Week narrative',
      highlights: 'Some highlights',
      patterns: 'Some patterns',
      errors: [],
    });
    mockGenerateMonthlySummary.mockResolvedValue({
      monthInReview: 'Month narrative',
      accomplishments: 'Some accomplishments',
      growth: 'Some growth',
      lookingAhead: 'Some threads',
      errors: [],
    });
  });

  afterEach(teardownTmpDir);

  it('chains daily → weekly → monthly in triggerAutoSummaries', async () => {
    // Set up entries for past days in January (W02)
    writeEntry('2026-01-05');
    writeEntry('2026-01-06');

    const result = await triggerAutoSummaries(tmpDir);

    // Should have generated daily, weekly, AND monthly summaries
    const dailyGenerated = result.generated.filter(p => p.includes('daily'));
    const weeklyGenerated = result.generated.filter(p => p.includes('weekly'));
    const monthlyGenerated = result.generated.filter(p => p.includes('monthly'));

    expect(dailyGenerated.length).toBeGreaterThanOrEqual(2);
    expect(weeklyGenerated.length).toBeGreaterThanOrEqual(1);
    expect(monthlyGenerated.length).toBeGreaterThanOrEqual(1);
  });
});
