import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { JsonEvalTestCaseStorageProvider, JsonEvalResultStorageProvider, JsonEvalChangelogStorageProvider } from '@/lib/storage';
import { StateEventEmitterImpl, StateEvent } from '@/services/slidegen-eval';
import { EvalTestCase, EvalTestResult } from '@/types/slidegen-eval';

/**
 * Unit tests for Test Cases API logic.
 */
describe('Test Cases API Logic', () => {
  let testDir: string;
  let testCaseStorage: JsonEvalTestCaseStorageProvider;
  let resultStorage: JsonEvalResultStorageProvider;
  let changelogStorage: JsonEvalChangelogStorageProvider;
  let emitter: StateEventEmitterImpl;
  let emittedEvents: StateEvent[];

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'tmp-test-api-testcases-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });

    testCaseStorage = new JsonEvalTestCaseStorageProvider(testDir);
    resultStorage = new JsonEvalResultStorageProvider(testDir);
    changelogStorage = new JsonEvalChangelogStorageProvider(testDir);
    emitter = new StateEventEmitterImpl();
    emittedEvents = [];

    emitter.subscribe((event) => emittedEvents.push(event));
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

  describe('Test Case CRUD', () => {
    it('should list empty when no test cases exist', async () => {
      const testCases = await testCaseStorage.listTestCases();
      expect(testCases).toEqual([]);
    });

    it('should create and list test cases', async () => {
      await testCaseStorage.createTestCase(createTestCase('tc-1', 'Marketing Slide', 'Q3 revenue grew 40%'));
      await testCaseStorage.createTestCase(createTestCase('tc-2', 'Tech Overview', 'AI is transforming'));

      const testCases = await testCaseStorage.listTestCases();
      expect(testCases).toHaveLength(2);
    });

    it('should get single test case by ID', async () => {
      await testCaseStorage.createTestCase(createTestCase('tc-1', 'Marketing Slide', 'Q3 revenue grew 40%'));

      const testCase = await testCaseStorage.getTestCase('tc-1');
      expect(testCase).not.toBeNull();
      expect(testCase!.name).toBe('Marketing Slide');
      expect(testCase!.inputText).toBe('Q3 revenue grew 40%');
    });

    it('should return null for non-existent test case', async () => {
      const testCase = await testCaseStorage.getTestCase('non-existent');
      expect(testCase).toBeNull();
    });

    it('should update test case', async () => {
      await testCaseStorage.createTestCase(createTestCase('tc-1', 'Original Name', 'Original Text'));

      const updated = createTestCase('tc-1', 'Updated Name', 'Updated Text');
      await testCaseStorage.updateTestCase(updated);

      const testCase = await testCaseStorage.getTestCase('tc-1');
      expect(testCase!.name).toBe('Updated Name');
      expect(testCase!.inputText).toBe('Updated Text');
    });

    it('should delete test case', async () => {
      await testCaseStorage.createTestCase(createTestCase('tc-1', 'Test', 'Text'));

      await testCaseStorage.deleteTestCase('tc-1');

      const testCase = await testCaseStorage.getTestCase('tc-1');
      expect(testCase).toBeNull();
    });
  });

  describe('SSE Events on Test Case Changes', () => {
    it('should emit test_case_added event', () => {
      emittedEvents.length = 0; // Clear connected event

      const testCase = createTestCase('tc-1', 'New Test', 'Input');
      emitter.emit({ type: 'test_case_added', testCase });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe('test_case_added');
    });

    it('should emit test_case_updated event', () => {
      emittedEvents.length = 0;

      const testCase = createTestCase('tc-1', 'Updated', 'Input');
      emitter.emit({ type: 'test_case_updated', testCase });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe('test_case_updated');
    });

    it('should emit test_case_deleted event', () => {
      emittedEvents.length = 0;

      emitter.emit({ type: 'test_case_deleted', testCaseId: 'tc-1' });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe('test_case_deleted');
      expect((emittedEvents[0] as { testCaseId: string }).testCaseId).toBe('tc-1');
    });
  });

  describe('Changelog on Test Case Changes', () => {
    it('should create changelog entry for create', async () => {
      await changelogStorage.appendEntry({
        id: 'cl-1',
        timestamp: new Date(),
        source: 'ui',
        action: 'test_case_created',
        summary: 'Test case "Marketing" created',
        details: { testCaseId: 'tc-1', name: 'Marketing' },
      });

      const entries = await changelogStorage.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('test_case_created');
    });

    it('should create changelog entry for update', async () => {
      await changelogStorage.appendEntry({
        id: 'cl-1',
        timestamp: new Date(),
        source: 'agent',
        action: 'test_case_updated',
        summary: 'Test case "Marketing" updated (name, input text)',
        details: { testCaseId: 'tc-1', changes: ['name', 'input text'] },
      });

      const entries = await changelogStorage.getEntries();
      expect(entries[0].action).toBe('test_case_updated');
      expect(entries[0].source).toBe('agent');
    });

    it('should create changelog entry for delete', async () => {
      await changelogStorage.appendEntry({
        id: 'cl-1',
        timestamp: new Date(),
        source: 'ui',
        action: 'test_case_deleted',
        summary: 'Test case "Marketing" deleted',
        details: { testCaseId: 'tc-1', name: 'Marketing' },
      });

      const entries = await changelogStorage.getEntries();
      expect(entries[0].action).toBe('test_case_deleted');
    });
  });

  describe('Cascade Delete Results', () => {
    it('should delete associated results when test case is deleted', async () => {
      // Create test case and results
      await testCaseStorage.createTestCase(createTestCase('tc-1', 'Test', 'Input'));

      const result: EvalTestResult = {
        id: 'r-1',
        testCaseId: 'tc-1',
        configVersion: 1,
        enhancedPrompt: 'Enhanced',
        status: 'complete',
        runStartedAt: new Date(),
        runCompletedAt: new Date(),
      };
      await resultStorage.saveResult(result);

      // Verify result exists
      let results = await resultStorage.listResults();
      expect(results).toHaveLength(1);

      // Delete test case and results (simulating API behavior)
      await testCaseStorage.deleteTestCase('tc-1');
      await resultStorage.deleteResultsForTestCase('tc-1');

      // Verify result is deleted
      results = await resultStorage.listResults();
      expect(results).toHaveLength(0);
    });
  });

  describe('Input Text Preview Truncation', () => {
    it('should truncate long input text in list view', async () => {
      const longText = 'A'.repeat(200);
      await testCaseStorage.createTestCase(createTestCase('tc-1', 'Long', longText));

      const testCases = await testCaseStorage.listTestCases();
      expect(testCases[0].inputTextPreview.length).toBeLessThanOrEqual(100);
      expect(testCases[0].inputTextPreview.endsWith('...')).toBe(true);
    });

    it('should preserve full input text in get', async () => {
      const longText = 'A'.repeat(200);
      await testCaseStorage.createTestCase(createTestCase('tc-1', 'Long', longText));

      const testCase = await testCaseStorage.getTestCase('tc-1');
      expect(testCase!.inputText.length).toBe(200);
    });
  });
});
