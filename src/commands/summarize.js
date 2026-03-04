// ABOUTME: CLI handler for the "summarize" subcommand — backfill daily summaries on demand
// ABOUTME: Parses date/range args, orchestrates generation with progress output and --force flag

import { generateAndSaveDailySummary } from '../managers/summary-manager.js';
import { readDayEntries } from '../managers/summary-manager.js';
import { getSummaryPath } from '../utils/journal-paths.js';
import { access } from 'node:fs/promises';

/**
 * Validate a YYYY-MM-DD date string.
 * @param {string} str - Date string to validate
 * @returns {boolean} True if valid date format
 */
function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [year, month, day] = str.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Expand a date range (inclusive) into an array of YYYY-MM-DD strings.
 * @param {string} startStr - Start date (YYYY-MM-DD)
 * @param {string} endStr - End date (YYYY-MM-DD)
 * @returns {string[]} Array of date strings
 */
export function expandDateRange(startStr, endStr) {
  const dates = [];
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  const current = new Date(start);
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Parse arguments for the summarize subcommand.
 * @param {string[]} args - Arguments after "summarize"
 * @returns {{ dates: string[], force: boolean, help: boolean, error: string|null }}
 */
export function parseSummarizeArgs(args) {
  let force = false;
  let help = false;
  let dateArg = null;

  for (const arg of args) {
    if (arg === '--force') {
      force = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (!arg.startsWith('-')) {
      dateArg = arg;
    }
  }

  if (help) {
    return { dates: [], force, help: true, error: null };
  }

  if (!dateArg) {
    return { dates: [], force, help: false, error: 'Missing date argument. Usage: commit-story summarize <date|date-range> [--force]' };
  }

  // Check for range (date..date)
  if (dateArg.includes('..')) {
    const parts = dateArg.split('..');
    if (parts.length !== 2) {
      return { dates: [], force, help: false, error: `Invalid date range: ${dateArg}` };
    }
    const [a, b] = parts;
    if (!isValidDate(a) || !isValidDate(b)) {
      return { dates: [], force, help: false, error: `Invalid date in range: ${dateArg}` };
    }
    // Normalize reversed ranges to ascending
    const start = a <= b ? a : b;
    const end = a <= b ? b : a;
    const dates = expandDateRange(start, end);
    return { dates, force, help: false, error: null };
  }

  // Single date
  if (!isValidDate(dateArg)) {
    return { dates: [], force, help: false, error: `Invalid date format: ${dateArg}. Expected YYYY-MM-DD` };
  }

  return { dates: [dateArg], force, help: false, error: null };
}

/**
 * Run the summarize command — generate daily summaries for the given dates.
 * @param {{ dates: string[], force: boolean, basePath?: string, onProgress?: (msg: string) => void }} options
 * @returns {Promise<{ generated: string[], noEntries: string[], alreadyExists: string[], failed: string[], errors: string[] }>}
 */
export async function runSummarize(options) {
  const { dates, force, basePath = '.', onProgress } = options;

  const result = {
    generated: [],
    noEntries: [],
    alreadyExists: [],
    failed: [],
    errors: [],
  };

  for (const dateStr of dates) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    try {
      // Check for entries first
      const entries = await readDayEntries(date, basePath);
      if (entries.length === 0) {
        result.noEntries.push(dateStr);
        if (onProgress) {
          onProgress(`Skipped ${dateStr}: no entries`);
        }
        continue;
      }

      // Check for existing summary (unless --force)
      if (!force) {
        const summaryPath = getSummaryPath('daily', date, basePath);
        try {
          await access(summaryPath);
          result.alreadyExists.push(dateStr);
          if (onProgress) {
            onProgress(`Skipped ${dateStr}: summary already exists`);
          }
          continue;
        } catch {
          // Doesn't exist, proceed
        }
      }

      // Generate and save
      const genResult = await generateAndSaveDailySummary(date, basePath, { force });

      if (genResult.saved) {
        result.generated.push(dateStr);
        if (onProgress) {
          onProgress(`Generated summary for ${dateStr} (${genResult.entryCount} entries)`);
        }
        if (genResult.errors && genResult.errors.length > 0) {
          for (const err of genResult.errors) {
            result.errors.push(`${dateStr}: ${err}`);
          }
        }
      } else {
        // Shouldn't happen since we checked above, but handle gracefully
        result.noEntries.push(dateStr);
      }
    } catch (err) {
      result.failed.push(dateStr);
      result.errors.push(`${dateStr}: ${err.message}`);
      if (onProgress) {
        onProgress(`Failed ${dateStr}: ${err.message}`);
      }
    }
  }

  return result;
}

/**
 * Show help text for the summarize subcommand.
 */
export function showSummarizeHelp() {
  console.log(`
Commit Story — Summarize

Generate daily summaries for journal entries.

Usage:
  npx commit-story summarize <date> [--force]
  npx commit-story summarize <start>..<end> [--force]

Arguments:
  date         Single date (YYYY-MM-DD)
  start..end   Date range (inclusive, YYYY-MM-DD..YYYY-MM-DD)

Options:
  --force      Regenerate existing summaries
  --help, -h   Show this help message

Examples:
  npx commit-story summarize 2026-02-22
  npx commit-story summarize 2026-02-01..2026-02-20
  npx commit-story summarize 2026-02-22 --force
`);
}
