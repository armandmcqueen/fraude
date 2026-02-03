import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { JsonEvalTestCaseStorageProvider } from '@/lib/storage/json-eval-testcase-storage';
import { EvalTestCase } from '@/types/slidegen-eval';

describe('JsonEvalTestCaseStorageProvider', () => {
  let storage: JsonEvalTestCaseStorageProvider;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'tmp-test-eval-testcase-' + Date.now());
    storage = new JsonEvalTestCaseStorageProvider(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createTestCase = (id: string, name: string, inputText: string): EvalTestCase => ({
    id,
    name,
    inputText,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('listTestCases', () => {
    it('should return empty array when no test cases exist', async () => {
      const result = await storage.listTestCases();
      expect(result).toEqual([]);
    });

    it('should return test case summaries sorted by name', async () => {
      await storage.createTestCase(createTestCase('tc1', 'Zebra Case', 'Content 1'));
      await storage.createTestCase(createTestCase('tc2', 'Alpha Case', 'Content 2'));
      await storage.createTestCase(createTestCase('tc3', 'Beta Case', 'Content 3'));

      const result = await storage.listTestCases();
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Alpha Case');
      expect(result[1].name).toBe('Beta Case');
      expect(result[2].name).toBe('Zebra Case');
    });

    it('should truncate long input text in preview', async () => {
      const longText = 'A'.repeat(200);
      await storage.createTestCase(createTestCase('tc1', 'Long Case', longText));

      const result = await storage.listTestCases();
      expect(result[0].inputTextPreview.length).toBeLessThanOrEqual(100);
      expect(result[0].inputTextPreview.endsWith('...')).toBe(true);
    });

    it('should not truncate short input text in preview', async () => {
      const shortText = 'Short content';
      await storage.createTestCase(createTestCase('tc1', 'Short Case', shortText));

      const result = await storage.listTestCases();
      expect(result[0].inputTextPreview).toBe(shortText);
    });
  });

  describe('getTestCase', () => {
    it('should return null for non-existent test case', async () => {
      const result = await storage.getTestCase('non-existent');
      expect(result).toBeNull();
    });

    it('should return full test case', async () => {
      const testCase = createTestCase('tc1', 'Test Case 1', 'Full input text content');
      await storage.createTestCase(testCase);

      const result = await storage.getTestCase('tc1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('tc1');
      expect(result!.name).toBe('Test Case 1');
      expect(result!.inputText).toBe('Full input text content');
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('createTestCase', () => {
    it('should create test case file on disk', async () => {
      await storage.createTestCase(createTestCase('tc1', 'Test', 'Content'));

      const filePath = path.join(testDir, 'test-cases.json');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should allow creating multiple test cases', async () => {
      await storage.createTestCase(createTestCase('tc1', 'Test 1', 'Content 1'));
      await storage.createTestCase(createTestCase('tc2', 'Test 2', 'Content 2'));
      await storage.createTestCase(createTestCase('tc3', 'Test 3', 'Content 3'));

      const result = await storage.listTestCases();
      expect(result).toHaveLength(3);
    });
  });

  describe('updateTestCase', () => {
    it('should update existing test case', async () => {
      await storage.createTestCase(createTestCase('tc1', 'Original Name', 'Original Content'));

      const updated: EvalTestCase = {
        id: 'tc1',
        name: 'Updated Name',
        inputText: 'Updated Content',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await storage.updateTestCase(updated);

      const result = await storage.getTestCase('tc1');
      expect(result!.name).toBe('Updated Name');
      expect(result!.inputText).toBe('Updated Content');
    });

    it('should throw error for non-existent test case', async () => {
      const testCase = createTestCase('non-existent', 'Name', 'Content');
      await expect(storage.updateTestCase(testCase)).rejects.toThrow('Test case not found');
    });
  });

  describe('deleteTestCase', () => {
    it('should delete existing test case', async () => {
      await storage.createTestCase(createTestCase('tc1', 'Test 1', 'Content 1'));
      await storage.createTestCase(createTestCase('tc2', 'Test 2', 'Content 2'));

      await storage.deleteTestCase('tc1');

      const list = await storage.listTestCases();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('tc2');

      const deleted = await storage.getTestCase('tc1');
      expect(deleted).toBeNull();
    });

    it('should silently handle non-existent test case', async () => {
      // Should not throw
      await storage.deleteTestCase('non-existent');
    });
  });

  describe('persistence', () => {
    it('should persist test cases across provider instances', async () => {
      await storage.createTestCase(createTestCase('tc1', 'Persistent', 'Persistent content'));

      const storage2 = new JsonEvalTestCaseStorageProvider(testDir);
      const result = await storage2.getTestCase('tc1');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Persistent');
      expect(result!.inputText).toBe('Persistent content');
    });
  });
});
