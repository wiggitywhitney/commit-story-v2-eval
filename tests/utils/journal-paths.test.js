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
