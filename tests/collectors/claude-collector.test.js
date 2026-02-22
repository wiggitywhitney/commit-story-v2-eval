import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  encodeProjectPath,
  parseJSONLFile,
  filterMessages,
  groupBySession,
  findJSONLFiles,
  getClaudeProjectsDir,
} from '../../src/collectors/claude-collector.js';

/**
 * Helper: create a JSONL message record
 */
function _makeRecord({
  uuid = crypto.randomUUID(),
  type = 'user',
  sessionId = 'session-1',
  timestamp = '2026-02-21T10:00:00Z',
  cwd = '/Users/dev/project',
  content = 'Hello world',
  isMeta = false,
} = {}) {
  return {
    uuid,
    type,
    sessionId,
    timestamp,
    cwd,
    isMeta,
    message: { content },
  };
}

/**
 * Helper: write a JSONL file from an array of records
 */
function writeJSONLFile(filePath, records) {
  const content = records.map((r) => JSON.stringify(r)).join('\n');
  writeFileSync(filePath, content, 'utf-8');
}

describe('encodeProjectPath', () => {
  it('replaces forward slashes with hyphens', () => {
    expect(encodeProjectPath('/Users/dev/project')).toBe('-Users-dev-project');
  });

  it('replaces dots with hyphens', () => {
    expect(encodeProjectPath('/Users/dev/my.project')).toBe('-Users-dev-my-project');
  });

  it('handles both slashes and dots', () => {
    expect(encodeProjectPath('/Users/dev/.config/project')).toBe('-Users-dev--config-project');
  });

  it('removes trailing slash before encoding', () => {
    expect(encodeProjectPath('/Users/dev/project/')).toBe('-Users-dev-project');
  });

  it('handles path without trailing slash unchanged', () => {
    expect(encodeProjectPath('/Users/dev/project')).toBe('-Users-dev-project');
  });
});

describe('getClaudeProjectsDir', () => {
  it('returns a path ending with .claude/projects', () => {
    const dir = getClaudeProjectsDir();
    expect(dir).toMatch(/\.claude\/projects$/);
  });
});

describe('parseJSONLFile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'claude-collector-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses valid JSONL records', () => {
    const filePath = join(tmpDir, 'chat.jsonl');
    const records = [
      _makeRecord({ uuid: 'u1', timestamp: '2026-02-21T10:00:00Z' }),
      _makeRecord({ uuid: 'u2', timestamp: '2026-02-21T10:01:00Z' }),
    ];
    writeJSONLFile(filePath, records);

    const result = parseJSONLFile(filePath);
    expect(result).toHaveLength(2);
    expect(result[0].uuid).toBe('u1');
    expect(result[1].uuid).toBe('u2');
  });

  it('skips empty lines', () => {
    const filePath = join(tmpDir, 'chat.jsonl');
    const record = _makeRecord({ uuid: 'u1' });
    writeFileSync(filePath, JSON.stringify(record) + '\n\n\n', 'utf-8');

    const result = parseJSONLFile(filePath);
    expect(result).toHaveLength(1);
  });

  it('skips malformed JSON lines', () => {
    const filePath = join(tmpDir, 'chat.jsonl');
    const record = _makeRecord({ uuid: 'u1' });
    writeFileSync(filePath, JSON.stringify(record) + '\n{invalid json}\n', 'utf-8');

    const result = parseJSONLFile(filePath);
    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe('u1');
  });

  it('skips non-conversation record types', () => {
    const filePath = join(tmpDir, 'chat.jsonl');
    const records = [
      _makeRecord({ uuid: 'u1' }),
      { type: 'file-history-snapshot', uuid: 'u2', timestamp: '2026-02-21T10:00:00Z' },
      { type: 'progress', uuid: 'u3', timestamp: '2026-02-21T10:00:00Z' },
      { type: 'queue-operation', uuid: 'u4', timestamp: '2026-02-21T10:00:00Z' },
      { type: 'system', uuid: 'u5', timestamp: '2026-02-21T10:00:00Z' },
    ];
    writeJSONLFile(filePath, records);

    const result = parseJSONLFile(filePath);
    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe('u1');
  });

  it('skips records without uuid', () => {
    const filePath = join(tmpDir, 'chat.jsonl');
    writeFileSync(filePath, JSON.stringify({ type: 'user', timestamp: '2026-02-21T10:00:00Z' }), 'utf-8');

    const result = parseJSONLFile(filePath);
    expect(result).toHaveLength(0);
  });

  it('skips records without timestamp', () => {
    const filePath = join(tmpDir, 'chat.jsonl');
    writeFileSync(filePath, JSON.stringify({ type: 'user', uuid: 'u1' }), 'utf-8');

    const result = parseJSONLFile(filePath);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for non-existent file', () => {
    const result = parseJSONLFile(join(tmpDir, 'nonexistent.jsonl'));
    expect(result).toEqual([]);
  });
});

describe('filterMessages', () => {
  const repoPath = '/Users/dev/project';

  it('filters messages within time window and matching repo path', () => {
    const messages = [
      _makeRecord({ uuid: 'u1', cwd: repoPath, timestamp: '2026-02-21T10:30:00Z' }),
      _makeRecord({ uuid: 'u2', cwd: repoPath, timestamp: '2026-02-21T11:30:00Z' }),
      _makeRecord({ uuid: 'u3', cwd: repoPath, timestamp: '2026-02-21T13:00:00Z' }), // outside window
    ];
    const start = new Date('2026-02-21T10:00:00Z');
    const end = new Date('2026-02-21T12:00:00Z');

    const result = filterMessages(messages, repoPath, start, end);
    expect(result).toHaveLength(2);
    expect(result[0].uuid).toBe('u1');
    expect(result[1].uuid).toBe('u2');
  });

  it('excludes messages from different repo path', () => {
    const messages = [
      _makeRecord({ uuid: 'u1', cwd: repoPath, timestamp: '2026-02-21T10:30:00Z' }),
      _makeRecord({ uuid: 'u2', cwd: '/Users/dev/other-project', timestamp: '2026-02-21T10:30:00Z' }),
    ];
    const start = new Date('2026-02-21T10:00:00Z');
    const end = new Date('2026-02-21T12:00:00Z');

    const result = filterMessages(messages, repoPath, start, end);
    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe('u1');
  });

  it('includes messages at exact boundary times (inclusive)', () => {
    const start = new Date('2026-02-21T10:00:00Z');
    const end = new Date('2026-02-21T12:00:00Z');
    const messages = [
      _makeRecord({ uuid: 'at-start', cwd: repoPath, timestamp: '2026-02-21T10:00:00Z' }),
      _makeRecord({ uuid: 'at-end', cwd: repoPath, timestamp: '2026-02-21T12:00:00Z' }),
    ];

    const result = filterMessages(messages, repoPath, start, end);
    expect(result).toHaveLength(2);
  });

  it('sorts results chronologically', () => {
    const messages = [
      _makeRecord({ uuid: 'later', cwd: repoPath, timestamp: '2026-02-21T11:00:00Z' }),
      _makeRecord({ uuid: 'earlier', cwd: repoPath, timestamp: '2026-02-21T10:30:00Z' }),
    ];
    const start = new Date('2026-02-21T10:00:00Z');
    const end = new Date('2026-02-21T12:00:00Z');

    const result = filterMessages(messages, repoPath, start, end);
    expect(result[0].uuid).toBe('earlier');
    expect(result[1].uuid).toBe('later');
  });

  it('returns empty array when no messages match', () => {
    const messages = [
      _makeRecord({ uuid: 'u1', cwd: '/other/path', timestamp: '2026-02-21T10:30:00Z' }),
    ];
    const start = new Date('2026-02-21T10:00:00Z');
    const end = new Date('2026-02-21T12:00:00Z');

    const result = filterMessages(messages, repoPath, start, end);
    expect(result).toEqual([]);
  });
});

describe('groupBySession', () => {
  it('groups messages by sessionId', () => {
    const messages = [
      _makeRecord({ sessionId: 'session-a', timestamp: '2026-02-21T10:00:00Z' }),
      _makeRecord({ sessionId: 'session-b', timestamp: '2026-02-21T10:01:00Z' }),
      _makeRecord({ sessionId: 'session-a', timestamp: '2026-02-21T10:02:00Z' }),
    ];

    const sessions = groupBySession(messages);
    expect(sessions.size).toBe(2);
    expect(sessions.get('session-a')).toHaveLength(2);
    expect(sessions.get('session-b')).toHaveLength(1);
  });

  it('sorts messages within each session chronologically', () => {
    const messages = [
      _makeRecord({ sessionId: 'session-a', uuid: 'later', timestamp: '2026-02-21T11:00:00Z' }),
      _makeRecord({ sessionId: 'session-a', uuid: 'earlier', timestamp: '2026-02-21T10:00:00Z' }),
    ];

    const sessions = groupBySession(messages);
    const sessionA = sessions.get('session-a');
    expect(sessionA[0].uuid).toBe('earlier');
    expect(sessionA[1].uuid).toBe('later');
  });

  it('skips messages without sessionId', () => {
    const messages = [
      _makeRecord({ sessionId: 'session-a' }),
      { uuid: 'no-session', type: 'user', timestamp: '2026-02-21T10:00:00Z' },
    ];

    const sessions = groupBySession(messages);
    expect(sessions.size).toBe(1);
  });

  it('returns empty map for empty input', () => {
    const sessions = groupBySession([]);
    expect(sessions.size).toBe(0);
  });
});

describe('findJSONLFiles', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'claude-find-jsonl-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns JSONL files sorted by modification time (newest first)', async () => {
    // Create files with different modification times
    const file1 = join(tmpDir, 'older.jsonl');
    const file2 = join(tmpDir, 'newer.jsonl');
    writeFileSync(file1, '{}', 'utf-8');

    // Small delay to ensure different mtime
    await new Promise((resolve) => setTimeout(resolve, 50));
    writeFileSync(file2, '{}', 'utf-8');

    const result = findJSONLFiles(tmpDir);
    expect(result).toHaveLength(2);
    // Newest first
    expect(result[0]).toBe(file2);
    expect(result[1]).toBe(file1);
  });

  it('ignores non-JSONL files', () => {
    writeFileSync(join(tmpDir, 'chat.jsonl'), '{}', 'utf-8');
    writeFileSync(join(tmpDir, 'notes.txt'), 'text', 'utf-8');
    writeFileSync(join(tmpDir, 'config.json'), '{}', 'utf-8');

    const result = findJSONLFiles(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/chat\.jsonl$/);
  });

  it('ignores directories', () => {
    writeFileSync(join(tmpDir, 'chat.jsonl'), '{}', 'utf-8');
    mkdirSync(join(tmpDir, 'subdir.jsonl'));

    const result = findJSONLFiles(tmpDir);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for non-existent directory', () => {
    const result = findJSONLFiles(join(tmpDir, 'nonexistent'));
    expect(result).toEqual([]);
  });

  it('returns empty array for empty directory', () => {
    const result = findJSONLFiles(tmpDir);
    expect(result).toEqual([]);
  });
});
