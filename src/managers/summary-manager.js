// ABOUTME: Orchestrates daily summary generation — reads entries, calls summary graph, writes output
// ABOUTME: Handles duplicate detection via file existence (DD-003) and force-regeneration

import { readFile, writeFile, access } from 'node:fs/promises';
import { generateDailySummary } from '../generators/summary-graph.js';
import {
  getJournalEntryPath,
  getSummaryPath,
  getDateString,
  ensureDirectory,
} from '../utils/journal-paths.js';

/** Separator between journal entries (matches journal-manager.js) */
const ENTRY_SEPARATOR = '═══════════════════════════════════════';

/**
 * Read all journal entries for a given date.
 * Splits the day's entry file by separator into individual entries.
 * @param {Date} date - Date to read entries for
 * @param {string} basePath - Base path for journal (default: current directory)
 * @returns {Promise<string[]>} Array of individual entry strings
 */
export async function readDayEntries(date, basePath = '.') {
  const entryPath = getJournalEntryPath(date, basePath);

  let content;
  try {
    content = await readFile(entryPath, 'utf-8');
  } catch {
    return [];
  }

  if (!content || !content.trim()) {
    return [];
  }

  // Split by separator, filter out empty parts
  const entries = content
    .split(ENTRY_SEPARATOR)
    .map(e => e.trim())
    .filter(e => e.length > 0);

  return entries;
}

/**
 * Format daily summary sections into markdown output.
 * @param {{ narrative: string, keyDecisions: string, openThreads: string }} sections - Summary sections
 * @param {string} dateStr - Date string (YYYY-MM-DD) for the header
 * @returns {string} Formatted markdown summary
 */
export function formatDailySummary(sections, dateStr) {
  const lines = [];

  lines.push(`# Daily Summary — ${dateStr}`);
  lines.push('');
  lines.push('## Narrative');
  lines.push('');
  lines.push(sections.narrative || '[No narrative generated]');
  lines.push('');
  lines.push('## Key Decisions');
  lines.push('');
  lines.push(sections.keyDecisions || 'No key decisions documented today.');
  lines.push('');
  lines.push('## Open Threads');
  lines.push('');
  lines.push(sections.openThreads || 'No open threads identified.');
  lines.push('');

  return lines.join('\n');
}

/**
 * Save a daily summary to the summaries directory.
 * Checks for existing file to prevent duplicates (DD-003).
 * @param {string} content - Formatted markdown summary
 * @param {Date} date - Date for the summary
 * @param {string} basePath - Base path for journal (default: current directory)
 * @param {{ force?: boolean }} options - Options
 * @returns {Promise<string|null>} Path to saved file, or null if skipped
 */
export async function saveDailySummary(content, date, basePath = '.', options = {}) {
  const summaryPath = getSummaryPath('daily', date, basePath);

  // Check for existing summary (DD-003: file existence for duplicate detection)
  if (!options.force) {
    try {
      await access(summaryPath);
      // File exists, skip
      return null;
    } catch {
      // File doesn't exist, proceed
    }
  }

  await ensureDirectory(summaryPath);
  await writeFile(summaryPath, content, 'utf-8');

  return summaryPath;
}

/**
 * Full pipeline: read entries for a date, generate summary, save to file.
 * @param {Date} date - Date to generate summary for
 * @param {string} basePath - Base path for journal (default: current directory)
 * @param {{ force?: boolean }} options - Options
 * @returns {Promise<{ saved: boolean, path?: string, reason?: string, entryCount?: number, errors?: string[] }>}
 */
export async function generateAndSaveDailySummary(date, basePath = '.', options = {}) {
  const dateStr = getDateString(date);

  // Check for existing summary first (avoid reading entries unnecessarily)
  if (!options.force) {
    const summaryPath = getSummaryPath('daily', date, basePath);
    try {
      await access(summaryPath);
      return { saved: false, reason: `Summary already exists for ${dateStr}` };
    } catch {
      // Doesn't exist, proceed
    }
  }

  // Read entries for the date
  const entries = await readDayEntries(date, basePath);
  if (entries.length === 0) {
    return { saved: false, reason: `Skipped ${dateStr}: no entries found` };
  }

  // Generate summary via LangGraph
  const result = await generateDailySummary(entries, dateStr);

  // Format the output
  const formatted = formatDailySummary(result, dateStr);

  // Save to file
  const path = await saveDailySummary(formatted, date, basePath, options);

  return {
    saved: true,
    path,
    entryCount: entries.length,
    errors: result.errors || [],
  };
}
