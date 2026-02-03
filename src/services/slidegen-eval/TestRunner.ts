import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI, Modality } from '@google/genai';
import { config } from '@/lib/config';
import {
  JsonEvalConfigStorageProvider,
  JsonEvalTestCaseStorageProvider,
  JsonEvalResultStorageProvider,
  JsonImageStorageProvider,
} from '@/lib/storage';
import { EvalTestResult, EvalTestCase, PromptEnhancerConfig } from '@/types/slidegen-eval';
import { stateEventEmitter } from './StateEventEmitter';
import { createChangelogEntry, generateId } from '@/app/api/slidegen-eval/helpers';

// Default system prompt if none is configured
const DEFAULT_SYSTEM_PROMPT = `You are an expert at creating prompts for image generation models. Your task is to take raw content (ideas, text, concepts) and transform them into effective prompts for generating text-centric presentation slides.

The slides should be TEXT-CENTRIC. The text on the slide should communicate the core idea.

Output ONLY the image generation prompt, nothing else.`;

export interface TestRunnerDeps {
  configStorage?: JsonEvalConfigStorageProvider;
  testCaseStorage?: JsonEvalTestCaseStorageProvider;
  resultStorage?: JsonEvalResultStorageProvider;
  imageStorage?: JsonImageStorageProvider;
  anthropicClient?: Anthropic;
  geminiClient?: GoogleGenAI;
}

export interface TestRunProgress {
  resultId: string;
  testCaseId: string;
  status: EvalTestResult['status'];
  enhancedPrompt?: string;
  generatedImageId?: string;
  imageError?: string;
}

/**
 * TestRunner executes test cases through the Prompt Enhancer → Image Generator pipeline.
 *
 * The execution flow:
 * 1. Create pending result, emit SSE event
 * 2. Call Claude with system prompt + input → Get enhanced prompt
 * 3. Update result, emit SSE event (status: generating_image)
 * 4. Call Gemini with enhanced prompt → Get image
 * 5. Save image to storage
 * 6. Update result, emit SSE event (status: complete)
 *
 * All state changes are emitted via SSE for real-time UI updates.
 */
export class TestRunner {
  private configStorage: JsonEvalConfigStorageProvider;
  private testCaseStorage: JsonEvalTestCaseStorageProvider;
  private resultStorage: JsonEvalResultStorageProvider;
  private imageStorage: JsonImageStorageProvider;
  private anthropic: Anthropic | null;
  private gemini: GoogleGenAI | null;

  constructor(deps: TestRunnerDeps = {}) {
    this.configStorage = deps.configStorage || new JsonEvalConfigStorageProvider();
    this.testCaseStorage = deps.testCaseStorage || new JsonEvalTestCaseStorageProvider();
    this.resultStorage = deps.resultStorage || new JsonEvalResultStorageProvider();
    this.imageStorage = deps.imageStorage || new JsonImageStorageProvider();

    // Initialize API clients (may be null if keys not configured)
    this.anthropic = deps.anthropicClient || (config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey }) : null);
    this.gemini = deps.geminiClient || (config.geminiApiKey ? new GoogleGenAI({ apiKey: config.geminiApiKey }) : null);
  }

  /**
   * Run a single test case.
   */
  async runTest(testCaseId: string, source: 'ui' | 'agent' = 'ui'): Promise<EvalTestResult> {
    // Get test case
    const testCase = await this.testCaseStorage.getTestCase(testCaseId);
    if (!testCase) {
      throw new Error(`Test case not found: ${testCaseId}`);
    }

    // Get config
    const evalConfig = await this.configStorage.getConfig();
    const systemPrompt = evalConfig?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const configVersion = evalConfig?.version || 0;

    // Create initial result
    const resultId = generateId();
    const result: EvalTestResult = {
      id: resultId,
      testCaseId,
      configVersion,
      enhancedPrompt: '',
      status: 'pending',
      runStartedAt: new Date(),
    };

    await this.resultStorage.saveResult(result);
    this.emitResultUpdate(result);

    // Create changelog entry
    await createChangelogEntry(
      source,
      'test_run_started',
      `Test run started for "${testCase.name}"`,
      { testCaseId, resultId }
    );

    try {
      // Step 1: Enhance prompt with Claude
      result.status = 'enhancing';
      await this.resultStorage.saveResult(result);
      this.emitResultUpdate(result);

      const enhancedPrompt = await this.runPromptEnhancer(systemPrompt, testCase.inputText);
      result.enhancedPrompt = enhancedPrompt;

      // Step 2: Generate image with Gemini
      result.status = 'generating_image';
      await this.resultStorage.saveResult(result);
      this.emitResultUpdate(result);

      const { imageId, error } = await this.generateImage(enhancedPrompt, testCase);

      if (error) {
        result.imageError = error;
        result.status = 'error';
      } else {
        result.generatedImageId = imageId;
        result.status = 'complete';
      }

      result.runCompletedAt = new Date();
      await this.resultStorage.saveResult(result);
      this.emitResultUpdate(result);

      // Create changelog entry for completion
      await createChangelogEntry(
        source,
        'test_run_completed',
        `Test run ${result.status === 'complete' ? 'completed' : 'failed'} for "${testCase.name}"`,
        { testCaseId, resultId, status: result.status }
      );

      return result;
    } catch (error) {
      // Handle unexpected errors
      result.status = 'error';
      result.imageError = error instanceof Error ? error.message : 'Unknown error';
      result.runCompletedAt = new Date();

      await this.resultStorage.saveResult(result);
      this.emitResultUpdate(result);

      await createChangelogEntry(
        source,
        'test_run_completed',
        `Test run failed for "${testCase.name}": ${result.imageError}`,
        { testCaseId, resultId, status: 'error', error: result.imageError }
      );

      return result;
    }
  }

  /**
   * Run all test cases.
   */
  async runAllTests(source: 'ui' | 'agent' = 'ui'): Promise<EvalTestResult[]> {
    const testCases = await this.testCaseStorage.listTestCases();
    const results: EvalTestResult[] = [];

    // Run tests sequentially to avoid overwhelming the APIs
    for (const tc of testCases) {
      const result = await this.runTest(tc.id, source);
      results.push(result);
    }

    return results;
  }

  /**
   * Run the prompt enhancer (Claude) to transform input into image generation prompt.
   */
  private async runPromptEnhancer(systemPrompt: string, inputText: string): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await this.anthropic.messages.create({
      model: config.defaultModel,
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Transform this content into an image generation prompt for a presentation slide:\n\n${inputText}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    return textBlock.text.trim();
  }

  /**
   * Generate an image using Gemini.
   */
  private async generateImage(
    prompt: string,
    testCase: EvalTestCase
  ): Promise<{ imageId?: string; error?: string }> {
    if (!this.gemini) {
      return { error: 'Gemini API key not configured' };
    }

    try {
      const response = await this.gemini.models.generateContent({
        model: config.defaultImageModel,
        contents: prompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts) {
        return { error: 'No response from Gemini' };
      }

      const imagePart = parts.find((part) => part.inlineData?.data);
      if (!imagePart?.inlineData) {
        return { error: 'No image in Gemini response' };
      }

      // Save image to storage
      const imageId = generateId();
      await this.imageStorage.saveImage(
        imageId,
        testCase.inputText,
        imagePart.inlineData.data,
        imagePart.inlineData.mimeType || 'image/png',
        { slidePrompt: prompt, isSlideMode: true }
      );

      return { imageId };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Image generation failed',
      };
    }
  }

  /**
   * Emit a test result update via SSE.
   */
  private emitResultUpdate(result: EvalTestResult): void {
    stateEventEmitter.emit({
      type: 'test_result_updated',
      result,
    });
  }
}

// Export singleton for use in API routes
export const testRunner = new TestRunner();
