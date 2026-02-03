import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { JsonEvalChangelogStorageProvider } from '@/lib/storage/json-eval-changelog-storage';
import { ChangelogEntry } from '@/types/slidegen-eval';

describe('JsonEvalChangelogStorageProvider', () => {
  let storage: JsonEvalChangelogStorageProvider;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'tmp-test-eval-changelog-' + Date.now());
    storage = new JsonEvalChangelogStorageProvider(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createEntry = (id: string, action: ChangelogEntry['action'], source: 'ui' | 'agent' = 'ui'): ChangelogEntry => ({
    id,
    timestamp: new Date(),
    source,
    action,
    summary: `Test ${action}`,
    details: { testKey: 'testValue' },
  });

  describe('getEntries', () => {
    it('should return empty array when no entries exist', async () => {
      const result = await storage.getEntries();
      expect(result).toEqual([]);
    });

    it('should return all entries when no sinceId provided', async () => {
      await storage.appendEntry(createEntry('e1', 'config_updated'));
      await storage.appendEntry(createEntry('e2', 'test_case_created'));
      await storage.appendEntry(createEntry('e3', 'test_run_started'));

      const result = await storage.getEntries();
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('e1');
      expect(result[1].id).toBe('e2');
      expect(result[2].id).toBe('e3');
    });

    it('should return entries after sinceId', async () => {
      await storage.appendEntry(createEntry('e1', 'config_updated'));
      await storage.appendEntry(createEntry('e2', 'test_case_created'));
      await storage.appendEntry(createEntry('e3', 'test_run_started'));

      const result = await storage.getEntries('e1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('e2');
      expect(result[1].id).toBe('e3');
    });

    it('should return all entries if sinceId not found (truncated)', async () => {
      await storage.appendEntry(createEntry('e2', 'config_updated'));
      await storage.appendEntry(createEntry('e3', 'test_case_created'));

      // e1 doesn't exist (was truncated)
      const result = await storage.getEntries('e1');
      expect(result).toHaveLength(2);
    });

    it('should return empty array if sinceId is last entry', async () => {
      await storage.appendEntry(createEntry('e1', 'config_updated'));
      await storage.appendEntry(createEntry('e2', 'test_case_created'));

      const result = await storage.getEntries('e2');
      expect(result).toEqual([]);
    });
  });

  describe('appendEntry', () => {
    it('should create changelog file on disk', async () => {
      await storage.appendEntry(createEntry('e1', 'config_updated'));

      const filePath = path.join(testDir, 'changelog.json');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should append entries in order', async () => {
      await storage.appendEntry(createEntry('e1', 'config_updated'));
      await storage.appendEntry(createEntry('e2', 'test_case_created'));
      await storage.appendEntry(createEntry('e3', 'test_run_completed', 'agent'));

      const result = await storage.getEntries();
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('e1');
      expect(result[2].id).toBe('e3');
      expect(result[2].source).toBe('agent');
    });

    it('should preserve entry data correctly', async () => {
      const entry = createEntry('e1', 'test_case_updated', 'agent');
      entry.details = { testCaseId: 'tc1', name: 'Updated name' };
      await storage.appendEntry(entry);

      const result = await storage.getEntries();
      expect(result[0].id).toBe('e1');
      expect(result[0].source).toBe('agent');
      expect(result[0].action).toBe('test_case_updated');
      expect(result[0].timestamp).toBeInstanceOf(Date);
      expect(result[0].details).toEqual({ testCaseId: 'tc1', name: 'Updated name' });
    });
  });

  describe('getLatestId', () => {
    it('should return null when no entries exist', async () => {
      const result = await storage.getLatestId();
      expect(result).toBeNull();
    });

    it('should return id of last entry', async () => {
      await storage.appendEntry(createEntry('e1', 'config_updated'));
      await storage.appendEntry(createEntry('e2', 'test_case_created'));
      await storage.appendEntry(createEntry('e3', 'test_run_completed'));

      const result = await storage.getLatestId();
      expect(result).toBe('e3');
    });
  });

  describe('truncate', () => {
    it('should keep only the last N entries', async () => {
      await storage.appendEntry(createEntry('e1', 'config_updated'));
      await storage.appendEntry(createEntry('e2', 'test_case_created'));
      await storage.appendEntry(createEntry('e3', 'test_run_started'));
      await storage.appendEntry(createEntry('e4', 'test_run_completed'));
      await storage.appendEntry(createEntry('e5', 'config_updated'));

      await storage.truncate(3);

      const result = await storage.getEntries();
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('e3');
      expect(result[1].id).toBe('e4');
      expect(result[2].id).toBe('e5');
    });

    it('should do nothing if entry count is less than keepCount', async () => {
      await storage.appendEntry(createEntry('e1', 'config_updated'));
      await storage.appendEntry(createEntry('e2', 'test_case_created'));

      await storage.truncate(10);

      const result = await storage.getEntries();
      expect(result).toHaveLength(2);
    });

    it('should handle keepCount of 0', async () => {
      await storage.appendEntry(createEntry('e1', 'config_updated'));
      await storage.appendEntry(createEntry('e2', 'test_case_created'));

      await storage.truncate(0);

      const result = await storage.getEntries();
      expect(result).toHaveLength(0);
    });
  });

  describe('persistence', () => {
    it('should persist entries across provider instances', async () => {
      await storage.appendEntry(createEntry('e1', 'config_updated'));
      await storage.appendEntry(createEntry('e2', 'test_case_created'));

      const storage2 = new JsonEvalChangelogStorageProvider(testDir);
      const result = await storage2.getEntries();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('e1');
      expect(result[1].id).toBe('e2');
    });
  });
});
