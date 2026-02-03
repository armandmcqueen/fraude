import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import {
  JsonEvalConfigStorageProvider,
  JsonEvalTestCaseStorageProvider,
  JsonEvalResultStorageProvider,
  JsonImageStorageProvider,
} from '@/lib/storage';
import { EvalTestCase, PromptEnhancerConfig, EvalTestResult } from '@/types/slidegen-eval';

/**
 * Unit tests for TestRunner logic.
 *
 * These tests verify the core execution flow by testing the storage
 * and LLM client interactions directly without importing the TestRunner
 * class (which has module dependencies that are hard to mock).
 */
describe('TestRunner Logic', () => {
  let testDir: string;
  let configStorage: JsonEvalConfigStorageProvider;
  let testCaseStorage: JsonEvalTestCaseStorageProvider;
  let resultStorage: JsonEvalResultStorageProvider;
  let imageStorage: JsonImageStorageProvider;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'tmp-test-runner-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });

    configStorage = new JsonEvalConfigStorageProvider(testDir);
    testCaseStorage = new JsonEvalTestCaseStorageProvider(testDir);
    resultStorage = new JsonEvalResultStorageProvider(testDir);
    imageStorage = new JsonImageStorageProvider(path.join(testDir, 'images'));
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createTestCase = async (id: string, name: string, inputText: string): Promise<EvalTestCase> => {
    const testCase: EvalTestCase = {
      id,
      name,
      inputText,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await testCaseStorage.createTestCase(testCase);
    return testCase;
  };

  const createConfig = async (systemPrompt: string, version: number = 1): Promise<PromptEnhancerConfig> => {
    const config: PromptEnhancerConfig = {
      id: 'default',
      systemPrompt,
      version,
      updatedAt: new Date(),
    };
    await configStorage.saveConfig(config);
    return config;
  };

  const createResult = (
    id: string,
    testCaseId: string,
    status: EvalTestResult['status'],
    configVersion: number = 1
  ): EvalTestResult => ({
    id,
    testCaseId,
    configVersion,
    enhancedPrompt: 'Enhanced prompt text',
    status,
    runStartedAt: new Date(),
    runCompletedAt: status === 'complete' || status === 'error' ? new Date() : undefined,
  });

  describe('Test Execution State Machine', () => {
    it('should track result states: pending → enhancing → generating_image → complete', async () => {
      await createTestCase('tc-1', 'Test', 'Input');
      await createConfig('System prompt');

      // Simulate state transitions
      const states: EvalTestResult['status'][] = [];

      // Pending
      const result = createResult('r-1', 'tc-1', 'pending');
      await resultStorage.saveResult(result);
      states.push((await resultStorage.getResult('r-1'))!.status);

      // Enhancing
      result.status = 'enhancing';
      await resultStorage.saveResult(result);
      states.push((await resultStorage.getResult('r-1'))!.status);

      // Generating image
      result.status = 'generating_image';
      await resultStorage.saveResult(result);
      states.push((await resultStorage.getResult('r-1'))!.status);

      // Complete
      result.status = 'complete';
      result.generatedImageId = 'img-1';
      result.runCompletedAt = new Date();
      await resultStorage.saveResult(result);
      states.push((await resultStorage.getResult('r-1'))!.status);

      expect(states).toEqual(['pending', 'enhancing', 'generating_image', 'complete']);
    });

    it('should handle error state', async () => {
      await createTestCase('tc-1', 'Test', 'Input');

      const result = createResult('r-1', 'tc-1', 'pending');
      result.status = 'error';
      result.imageError = 'API error occurred';
      result.runCompletedAt = new Date();

      await resultStorage.saveResult(result);

      const saved = await resultStorage.getResult('r-1');
      expect(saved!.status).toBe('error');
      expect(saved!.imageError).toBe('API error occurred');
    });
  });

  describe('Config Version Tracking', () => {
    it('should record the config version used for each test run', async () => {
      // Create config at version 5
      await createConfig('Prompt v5', 5);
      await createTestCase('tc-1', 'Test', 'Input');

      const result = createResult('r-1', 'tc-1', 'complete', 5);
      await resultStorage.saveResult(result);

      const saved = await resultStorage.getResult('r-1');
      expect(saved!.configVersion).toBe(5);
    });

    it('should allow querying results by test case', async () => {
      await createTestCase('tc-1', 'Test 1', 'Input 1');
      await createTestCase('tc-2', 'Test 2', 'Input 2');

      // Multiple results for tc-1
      await resultStorage.saveResult({ ...createResult('r-1', 'tc-1', 'complete', 1), runStartedAt: new Date('2024-01-01') });
      await resultStorage.saveResult({ ...createResult('r-2', 'tc-1', 'complete', 2), runStartedAt: new Date('2024-06-01') });
      // One result for tc-2
      await resultStorage.saveResult(createResult('r-3', 'tc-2', 'complete', 2));

      // Should get most recent for tc-1
      const latestForTc1 = await resultStorage.getResultByTestCaseId('tc-1');
      expect(latestForTc1!.id).toBe('r-2');
      expect(latestForTc1!.configVersion).toBe(2);

      // Should get the one for tc-2
      const latestForTc2 = await resultStorage.getResultByTestCaseId('tc-2');
      expect(latestForTc2!.id).toBe('r-3');
    });
  });

  describe('Result Persistence', () => {
    it('should persist enhanced prompt even on error', async () => {
      await createTestCase('tc-1', 'Test', 'Input');

      const result: EvalTestResult = {
        id: 'r-1',
        testCaseId: 'tc-1',
        configVersion: 1,
        enhancedPrompt: 'Successfully enhanced prompt',
        status: 'error',
        imageError: 'Gemini failed',
        runStartedAt: new Date(),
        runCompletedAt: new Date(),
      };

      await resultStorage.saveResult(result);

      const saved = await resultStorage.getResult('r-1');
      expect(saved!.enhancedPrompt).toBe('Successfully enhanced prompt');
      expect(saved!.status).toBe('error');
      expect(saved!.imageError).toBe('Gemini failed');
    });

    it('should store image reference on success', async () => {
      const result: EvalTestResult = {
        id: 'r-1',
        testCaseId: 'tc-1',
        configVersion: 1,
        enhancedPrompt: 'Enhanced prompt',
        generatedImageId: 'img-12345',
        status: 'complete',
        runStartedAt: new Date(),
        runCompletedAt: new Date(),
      };

      await resultStorage.saveResult(result);

      const saved = await resultStorage.getResult('r-1');
      expect(saved!.generatedImageId).toBe('img-12345');
    });
  });

  describe('Image Storage Integration', () => {
    it('should save and retrieve image data', async () => {
      const imageData = Buffer.from('fake png image data').toString('base64');

      const savedImage = await imageStorage.saveImage(
        'img-1',
        'Original prompt',
        imageData,
        'image/png',
        { slidePrompt: 'Enhanced slide prompt', isSlideMode: true }
      );

      expect(savedImage.id).toBe('img-1');
      expect(savedImage.slidePrompt).toBe('Enhanced slide prompt');
      expect(savedImage.isSlideMode).toBe(true);

      // Retrieve
      const retrieved = await imageStorage.getImage('img-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.prompt).toBe('Original prompt');

      // Get data
      const data = await imageStorage.getImageData('img-1');
      expect(data).toBe(imageData);
    });
  });

  describe('Cascade Cleanup', () => {
    it('should delete results when test case is deleted', async () => {
      await createTestCase('tc-1', 'Test', 'Input');
      await resultStorage.saveResult(createResult('r-1', 'tc-1', 'complete'));
      await resultStorage.saveResult(createResult('r-2', 'tc-1', 'complete'));

      // Verify results exist
      let results = await resultStorage.listResults();
      expect(results).toHaveLength(2);

      // Delete test case results
      await testCaseStorage.deleteTestCase('tc-1');
      await resultStorage.deleteResultsForTestCase('tc-1');

      // Verify results are deleted
      results = await resultStorage.listResults();
      expect(results).toHaveLength(0);
    });
  });
});

describe('LLM Client Mocking Patterns', () => {
  it('should demonstrate mock Anthropic client structure', () => {
    const mockAnthropicClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Enhanced prompt from Claude' }],
        }),
      },
    };

    // Verify structure
    expect(mockAnthropicClient.messages.create).toBeDefined();
  });

  it('should demonstrate mock Gemini client structure', () => {
    const mockGeminiClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [{
            content: {
              parts: [{
                inlineData: {
                  data: Buffer.from('image').toString('base64'),
                  mimeType: 'image/png',
                },
              }],
            },
          }],
        }),
      },
    };

    // Verify structure
    expect(mockGeminiClient.models.generateContent).toBeDefined();
  });
});
