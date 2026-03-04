// ABOUTME: Tests for journal path utility functions
// ABOUTME: Covers path generation for entries, reflections, context, and summaries
import { describe, it, expect } from 'vitest';
import {
  getYearMonth,
  getDateString,
  getJournalEntryPath,
  getReflectionPath,
  getContextPath,
  getReflectionsDirectory,
  parseDateFromFilename,
  getJournalRoot,
  getSummaryPath,
  getSummariesDirectory,
  getISOWeekString,
} from '../../src/utils/journal-paths.js';

describe('getYearMonth', () => {
  it('formats date as YYYY-MM', () => {
    expect(getYearMonth(new Date(2026, 1, 21))).toBe('2026-02');
  });

  it('zero-pads single-digit months', () => {
    expect(getYearMonth(new Date(2026, 0, 15))).toBe('2026-01');
  });

  it('handles December correctly', () => {
    expect(getYearMonth(new Date(2026, 11, 31))).toBe('2026-12');
  });
});

describe('getDateString', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(getDateString(new Date(2026, 1, 21))).toBe('2026-02-21');
  });

  it('zero-pads single-digit months and days', () => {
    expect(getDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('getJournalEntryPath', () => {
  it('returns path in entries/YYYY-MM/YYYY-MM-DD.md format', () => {
    const date = new Date(2026, 1, 21);
    const path = getJournalEntryPath(date, '/base');

    expect(path).toBe('/base/journal/entries/2026-02/2026-02-21.md');
  });

  it('defaults basePath to current directory', () => {
    const date = new Date(2026, 1, 21);
    const path = getJournalEntryPath(date);

    expect(path).toBe('journal/entries/2026-02/2026-02-21.md');
  });
});

describe('getReflectionPath', () => {
  it('returns path in reflections/YYYY-MM/YYYY-MM-DD.md format', () => {
    const date = new Date(2026, 1, 21);
    const path = getReflectionPath(date, '/base');

    expect(path).toBe('/base/journal/reflections/2026-02/2026-02-21.md');
  });
});

describe('getContextPath', () => {
  it('returns path in context/YYYY-MM/YYYY-MM-DD.md format', () => {
    const date = new Date(2026, 1, 21);
    const path = getContextPath(date, '/base');

    expect(path).toBe('/base/journal/context/2026-02/2026-02-21.md');
  });
});

describe('getReflectionsDirectory', () => {
  it('returns reflections directory for a date', () => {
    const date = new Date(2026, 1, 21);
    const dir = getReflectionsDirectory(date, '/base');

    expect(dir).toBe('/base/journal/reflections/2026-02');
  });
});

describe('parseDateFromFilename', () => {
  it('parses YYYY-MM-DD.md filename', () => {
    const date = parseDateFromFilename('2026-02-21.md');

    expect(date).toBeInstanceOf(Date);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1); // 0-indexed
    expect(date.getDate()).toBe(21);
  });

  it('returns null for non-matching filename', () => {
    expect(parseDateFromFilename('notes.md')).toBeNull();
    expect(parseDateFromFilename('2026-02.md')).toBeNull();
    expect(parseDateFromFilename('2026-02-21.txt')).toBeNull();
  });

  it('returns null for invalid date-like strings', () => {
    expect(parseDateFromFilename('abcd-ef-gh.md')).toBeNull();
  });
});

describe('getJournalRoot', () => {
  it('returns journal directory under basePath', () => {
    expect(getJournalRoot('/base')).toBe('/base/journal');
  });

  it('defaults to current directory', () => {
    expect(getJournalRoot()).toBe('journal');
  });
});

describe('getISOWeekString', () => {
  it('formats a mid-year date as YYYY-Www', () => {
    // 2026-02-23 is a Monday in ISO week 9
    expect(getISOWeekString(new Date(2026, 1, 23))).toBe('2026-W09');
  });

  it('zero-pads single-digit week numbers', () => {
    // 2026-01-05 is a Monday in ISO week 2
    expect(getISOWeekString(new Date(2026, 0, 5))).toBe('2026-W02');
  });

  it('handles ISO week-year boundary where calendar year differs', () => {
    // 2019-12-30 (Monday) is in ISO week 2020-W01
    expect(getISOWeekString(new Date(2019, 11, 30))).toBe('2020-W01');
  });

  it('handles week 53', () => {
    // 2020-12-31 (Thursday) is in ISO week 2020-W53
    expect(getISOWeekString(new Date(2020, 11, 31))).toBe('2020-W53');
  });

  it('handles first day of year that belongs to previous ISO year', () => {
    // 2027-01-01 (Friday) is in ISO week 2026-W53
    expect(getISOWeekString(new Date(2027, 0, 1))).toBe('2026-W53');
  });
});

describe('getSummaryPath', () => {
  it('returns daily summary path as summaries/daily/YYYY-MM-DD.md', () => {
    const date = new Date(2026, 1, 22);
    expect(getSummaryPath('daily', date, '/base')).toBe(
      '/base/journal/summaries/daily/2026-02-22.md'
    );
  });

  it('returns weekly summary path as summaries/weekly/YYYY-Www.md', () => {
    const date = new Date(2026, 1, 23); // Monday, week 9
    expect(getSummaryPath('weekly', date, '/base')).toBe(
      '/base/journal/summaries/weekly/2026-W09.md'
    );
  });

  it('returns monthly summary path as summaries/monthly/YYYY-MM.md', () => {
    const date = new Date(2026, 1, 22);
    expect(getSummaryPath('monthly', date, '/base')).toBe(
      '/base/journal/summaries/monthly/2026-02.md'
    );
  });

  it('defaults basePath to current directory', () => {
    const date = new Date(2026, 1, 22);
    expect(getSummaryPath('daily', date)).toBe(
      'journal/summaries/daily/2026-02-22.md'
    );
  });

  it('throws for invalid cadence', () => {
    const date = new Date(2026, 1, 22);
    expect(() => getSummaryPath('yearly', date)).toThrow('Invalid cadence');
  });
});

describe('getSummariesDirectory', () => {
  it('returns daily summaries directory', () => {
    expect(getSummariesDirectory('daily', '/base')).toBe(
      '/base/journal/summaries/daily'
    );
  });

  it('returns weekly summaries directory', () => {
    expect(getSummariesDirectory('weekly', '/base')).toBe(
      '/base/journal/summaries/weekly'
    );
  });

  it('returns monthly summaries directory', () => {
    expect(getSummariesDirectory('monthly', '/base')).toBe(
      '/base/journal/summaries/monthly'
    );
  });

  it('defaults basePath to current directory', () => {
    expect(getSummariesDirectory('daily')).toBe('journal/summaries/daily');
  });

  it('throws for invalid cadence', () => {
    expect(() => getSummariesDirectory('yearly')).toThrow('Invalid cadence');
  });
});
