// ABOUTME: Auto-trigger logic for daily, weekly, and monthly summaries after journal entry creation
// ABOUTME: Detects unsummarized past days/weeks/months and generates summaries with progress reporting

import { findUnsummarizedDays, findUnsummarizedWeeks, findUnsummarizedMonths } from '../utils/summary-detector.js';
import { generateAndSaveDailySummary, generateAndSaveWeeklySummary, generateAndSaveMonthlySummary } from './summary-manager.js';

/**
 * Trigger automatic daily summary generation for all unsummarized past days.
 * Generates summaries sequentially to avoid overwhelming the LLM API.
 * Continues past failures to maximize coverage.
 *
 * @param {string} basePath - Base path for journal (default: current directory)
 * @param {{ onProgress?: (msg: string) => void }} options - Options
 * @returns {Promise<{ generated: string[], skipped: string[], failed: string[], errors: string[] }>}
 */
export async function triggerAutoSummaries(basePath = '.', options = {}) {
  const { onProgress } = options;

  const unsummarizedDays = await findUnsummarizedDays(basePath);

  const result = {
    generated: [],
    skipped: [],
    failed: [],
    errors: [],
  };

  for (const dateStr of unsummarizedDays) {
    const date = new Date(
      parseInt(dateStr.slice(0, 4)),
      parseInt(dateStr.slice(5, 7)) - 1,
      parseInt(dateStr.slice(8, 10)),
    );

    try {
      const summaryResult = await generateAndSaveDailySummary(date, basePath);

      if (summaryResult.saved) {
        result.generated.push(summaryResult.path);
        if (onProgress) {
          onProgress(`Generated daily summary for ${dateStr}`);
        }

        // Track errors from generation (partial issues like LLM timeouts)
        if (summaryResult.errors && summaryResult.errors.length > 0) {
          for (const err of summaryResult.errors) {
            result.errors.push(`${dateStr}: ${err}`);
          }
        }
      } else {
        result.skipped.push(dateStr);
      }
    } catch (err) {
      result.failed.push(dateStr);
      result.errors.push(`${dateStr}: ${err.message}`);
      if (onProgress) {
        onProgress(`Failed to generate summary for ${dateStr}: ${err.message}`);
      }
    }
  }

  // After daily summaries are generated, check for unsummarized weeks
  const weeklyResult = await triggerAutoWeeklySummaries(basePath, options);

  // After weekly summaries are generated, check for unsummarized months
  const monthlyResult = await triggerAutoMonthlySummaries(basePath, options);

  return {
    generated: [...result.generated, ...weeklyResult.generated, ...monthlyResult.generated],
    skipped: [...result.skipped, ...weeklyResult.skipped, ...monthlyResult.skipped],
    failed: [...result.failed, ...weeklyResult.failed, ...monthlyResult.failed],
    errors: [...result.errors, ...weeklyResult.errors, ...monthlyResult.errors],
  };
}

/**
 * Trigger automatic weekly summary generation for all unsummarized past weeks.
 * A week is eligible when it has daily summaries and is no longer the current week.
 *
 * @param {string} basePath - Base path for journal (default: current directory)
 * @param {{ onProgress?: (msg: string) => void }} options - Options
 * @returns {Promise<{ generated: string[], skipped: string[], failed: string[], errors: string[] }>}
 */
export async function triggerAutoWeeklySummaries(basePath = '.', options = {}) {
  const { onProgress } = options;

  const unsummarizedWeeks = await findUnsummarizedWeeks(basePath);

  const result = {
    generated: [],
    skipped: [],
    failed: [],
    errors: [],
  };

  for (const weekStr of unsummarizedWeeks) {
    try {
      const summaryResult = await generateAndSaveWeeklySummary(weekStr, basePath);

      if (summaryResult.saved) {
        result.generated.push(summaryResult.path);
        if (onProgress) {
          onProgress(`Generated weekly summary for ${weekStr}`);
        }

        if (summaryResult.errors && summaryResult.errors.length > 0) {
          for (const err of summaryResult.errors) {
            result.errors.push(`${weekStr}: ${err}`);
          }
        }
      } else {
        result.skipped.push(weekStr);
      }
    } catch (err) {
      result.failed.push(weekStr);
      result.errors.push(`${weekStr}: ${err.message}`);
      if (onProgress) {
        onProgress(`Failed to generate weekly summary for ${weekStr}: ${err.message}`);
      }
    }
  }

  return result;
}

/**
 * Trigger automatic monthly summary generation for all unsummarized past months.
 * A month is eligible when it has weekly summaries and is no longer the current month.
 *
 * @param {string} basePath - Base path for journal (default: current directory)
 * @param {{ onProgress?: (msg: string) => void }} options - Options
 * @returns {Promise<{ generated: string[], skipped: string[], failed: string[], errors: string[] }>}
 */
export async function triggerAutoMonthlySummaries(basePath = '.', options = {}) {
  const { onProgress } = options;

  const unsummarizedMonths = await findUnsummarizedMonths(basePath);

  const result = {
    generated: [],
    skipped: [],
    failed: [],
    errors: [],
  };

  for (const monthStr of unsummarizedMonths) {
    try {
      const summaryResult = await generateAndSaveMonthlySummary(monthStr, basePath);

      if (summaryResult.saved) {
        result.generated.push(summaryResult.path);
        if (onProgress) {
          onProgress(`Generated monthly summary for ${monthStr}`);
        }

        if (summaryResult.errors && summaryResult.errors.length > 0) {
          for (const err of summaryResult.errors) {
            result.errors.push(`${monthStr}: ${err}`);
          }
        }
      } else {
        result.skipped.push(monthStr);
      }
    } catch (err) {
      result.failed.push(monthStr);
      result.errors.push(`${monthStr}: ${err.message}`);
      if (onProgress) {
        onProgress(`Failed to generate monthly summary for ${monthStr}: ${err.message}`);
      }
    }
  }

  return result;
}
