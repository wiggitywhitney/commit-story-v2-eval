// ABOUTME: Tests for monthly-summary-prompt.js — validates prompt template generation
// ABOUTME: Verifies scope guidance, section headers, banned words, and voice instructions

import { describe, it, expect } from 'vitest';
import { monthlySummaryPrompt } from '../../../src/generators/prompts/sections/monthly-summary-prompt.js';

describe('monthlySummaryPrompt', () => {
  it('returns a string prompt for multiple weeks', () => {
    const prompt = monthlySummaryPrompt(4);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('includes scope guidance for single week', () => {
    const prompt = monthlySummaryPrompt(1);
    expect(prompt).toContain('only 1 weekly summary');
    expect(prompt).toContain('do not inflate');
  });

  it('includes scope guidance for multiple weeks', () => {
    const prompt = monthlySummaryPrompt(4);
    expect(prompt).toContain('4 weekly summaries');
    expect(prompt).toContain('arc of the month');
  });

  it('specifies the four monthly section headers', () => {
    const prompt = monthlySummaryPrompt(3);
    expect(prompt).toContain('## Month in Review');
    expect(prompt).toContain('## Accomplishments');
    expect(prompt).toContain('## Growth');
    expect(prompt).toContain('## Looking Ahead');
  });

  it('includes banned words list', () => {
    const prompt = monthlySummaryPrompt(3);
    expect(prompt).toContain('BANNED WORDS');
    expect(prompt).toContain('comprehensive');
    expect(prompt).toContain('robust');
  });

  it('includes voice and tone guidelines', () => {
    const prompt = monthlySummaryPrompt(3);
    expect(prompt).toContain('contractions');
    expect(prompt).toContain('the developer');
    expect(prompt).toContain('third person');
  });

  it('instructs against week-by-week recaps', () => {
    const prompt = monthlySummaryPrompt(3);
    expect(prompt).toContain('Do NOT');
    // Should not be a week-by-week recap
    expect(prompt).toMatch(/week.by.week|Week 1.*Week 2/i);
  });

  it('includes verification step', () => {
    const prompt = monthlySummaryPrompt(3);
    expect(prompt).toContain('verify');
    expect(prompt).toContain('traces back');
  });
});
