import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { JsonEvalResultStorageProvider } from '@/lib/storage/json-eval-result-storage';
import { EvalTestResult } from '@/types/slidegen-eval';

describe('JsonEvalResultStorageProvider', () => {
  let storage: JsonEvalResultStorageProvider;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'tmp-test-eval-result-' + Date.now());
    storage = new JsonEvalResultStorageProvider(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createResult = (id: string, testCaseId: string, status: EvalTestResult['status'] = 'complete'): EvalTestResult => ({
    id,
    testCaseId,
    configVersion: 1,
    enhancedPrompt: 'Enhanced prompt text',
    generatedImageId: 'img-123',
    status,
    runStartedAt: new Date(),
    runCompletedAt: new Date(),
  });

  describe('listResults', () => {
    it('should return empty array when no results exist', async () => {
      const result = await storage.listResults();
      expect(result).toEqual([]);
    });

    it('should return all results', async () => {
      await storage.saveResult(createResult('r1', 'tc1'));
      await storage.saveResult(createResult('r2', 'tc2'));

      const result = await storage.listResults();
      expect(result).toHaveLength(2);
    });
  });

  describe('getResult', () => {
    it('should return null for non-existent result', async () => {
      const result = await storage.getResult('non-existent');
      expect(result).toBeNull();
    });

    it('should return result with correct types', async () => {
      await storage.saveResult(createResult('r1', 'tc1'));

      const result = await storage.getResult('r1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('r1');
      expect(result!.testCaseId).toBe('tc1');
      expect(result!.configVersion).toBe(1);
      expect(result!.enhancedPrompt).toBe('Enhanced prompt text');
      expect(result!.generatedImageId).toBe('img-123');
      expect(result!.status).toBe('complete');
      expect(result!.runStartedAt).toBeInstanceOf(Date);
      expect(result!.runCompletedAt).toBeInstanceOf(Date);
    });
  });

  describe('getResultByTestCaseId', () => {
    it('should return null when no result for test case', async () => {
      const result = await storage.getResultByTestCaseId('non-existent');
      expect(result).toBeNull();
    });

    it('should return result for test case', async () => {
      await storage.saveResult(createResult('r1', 'tc1'));
      await storage.saveResult(createResult('r2', 'tc2'));

      const result = await storage.getResultByTestCaseId('tc1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('r1');
    });

    it('should return most recent result when multiple exist', async () => {
      const older: EvalTestResult = {
        id: 'r1',
        testCaseId: 'tc1',
        configVersion: 1,
        enhancedPrompt: 'Old prompt',
        status: 'complete',
        runStartedAt: new Date('2024-01-01'),
        runCompletedAt: new Date('2024-01-01'),
      };
      const newer: EvalTestResult = {
        id: 'r2',
        testCaseId: 'tc1',
        configVersion: 2,
        enhancedPrompt: 'New prompt',
        status: 'complete',
        runStartedAt: new Date('2024-06-01'),
        runCompletedAt: new Date('2024-06-01'),
      };

      await storage.saveResult(older);
      await storage.saveResult(newer);

      const result = await storage.getResultByTestCaseId('tc1');
      expect(result!.id).toBe('r2');
      expect(result!.enhancedPrompt).toBe('New prompt');
    });
  });

  describe('saveResult', () => {
    it('should create results file on disk', async () => {
      await storage.saveResult(createResult('r1', 'tc1'));

      const filePath = path.join(testDir, 'test-results.json');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should update existing result', async () => {
      await storage.saveResult(createResult('r1', 'tc1', 'pending'));

      const updated: EvalTestResult = {
        id: 'r1',
        testCaseId: 'tc1',
        configVersion: 1,
        enhancedPrompt: 'Updated prompt',
        generatedImageId: 'img-456',
        status: 'complete',
        runStartedAt: new Date(),
        runCompletedAt: new Date(),
      };
      await storage.saveResult(updated);

      const results = await storage.listResults();
      expect(results).toHaveLength(1);
      expect(results[0].enhancedPrompt).toBe('Updated prompt');
      expect(results[0].status).toBe('complete');
    });

    it('should handle result without optional fields', async () => {
      const result: EvalTestResult = {
        id: 'r1',
        testCaseId: 'tc1',
        configVersion: 1,
        enhancedPrompt: 'Prompt',
        status: 'error',
        imageError: 'Image generation failed',
        runStartedAt: new Date(),
        // No runCompletedAt, no generatedImageId
      };
      await storage.saveResult(result);

      const saved = await storage.getResult('r1');
      expect(saved!.generatedImageId).toBeUndefined();
      expect(saved!.imageError).toBe('Image generation failed');
      expect(saved!.runCompletedAt).toBeUndefined();
    });
  });

  describe('deleteResultsForTestCase', () => {
    it('should delete all results for a test case', async () => {
      await storage.saveResult(createResult('r1', 'tc1'));
      await storage.saveResult(createResult('r2', 'tc1'));
      await storage.saveResult(createResult('r3', 'tc2'));

      await storage.deleteResultsForTestCase('tc1');

      const results = await storage.listResults();
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('r3');
    });

    it('should silently handle non-existent test case', async () => {
      await storage.saveResult(createResult('r1', 'tc1'));

      // Should not throw
      await storage.deleteResultsForTestCase('non-existent');

      const results = await storage.listResults();
      expect(results).toHaveLength(1);
    });
  });

  describe('persistence', () => {
    it('should persist results across provider instances', async () => {
      await storage.saveResult(createResult('r1', 'tc1'));

      const storage2 = new JsonEvalResultStorageProvider(testDir);
      const result = await storage2.getResult('r1');

      expect(result).not.toBeNull();
      expect(result!.testCaseId).toBe('tc1');
    });
  });
});
