import Anthropic from '@anthropic-ai/sdk';
import {
  JsonEvalConfigStorageProvider,
  JsonEvalConfigHistoryStorageProvider,
  JsonEvalTestCaseStorageProvider,
  JsonEvalResultStorageProvider,
} from '@/lib/storage';
import { stateEventEmitter } from '@/services/slidegen-eval';
import { testRunner } from '@/services/slidegen-eval/TestRunner';
import { createChangelogEntry } from '../../helpers';

const configStorage = new JsonEvalConfigStorageProvider();
const historyStorage = new JsonEvalConfigHistoryStorageProvider();
const testCaseStorage = new JsonEvalTestCaseStorageProvider();
const resultStorage = new JsonEvalResultStorageProvider();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Web search server tool definition.
 * This is executed by Anthropic's servers, not by our code.
 */
export const webSearchTool: Anthropic.Messages.WebSearchTool20250305 = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 5,
};

/**
 * Custom tool definitions for the slidegen eval agent.
 */
export const customTools: Anthropic.Messages.Tool[] = [
  {
    name: 'get_config',
    description: 'Get the current Prompt Enhancer configuration including the system prompt.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'update_system_prompt',
    description: 'Update the Prompt Enhancer system prompt and/or models. This replaces the entire system prompt.',
    input_schema: {
      type: 'object' as const,
      properties: {
        systemPrompt: {
          type: 'string',
          description: 'The new system prompt for the Prompt Enhancer',
        },
        model: {
          type: 'string',
          enum: ['haiku', 'sonnet', 'opus'],
          description: 'The Claude model to use for enhancement (haiku, sonnet, or opus). All are 4.5 versions.',
        },
        imageModel: {
          type: 'string',
          enum: ['gemini-2.5-flash', 'gemini-3-pro'],
          description: 'The Gemini model to use for image generation.',
        },
      },
      required: ['systemPrompt'],
    },
  },
  {
    name: 'list_test_cases',
    description: 'List all test cases with their names and input text.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_test_result',
    description: 'Get the most recent test result for a specific test case, including the enhanced prompt and image generation status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        testCaseId: {
          type: 'string',
          description: 'The ID of the test case to get the result for',
        },
      },
      required: ['testCaseId'],
    },
  },
  {
    name: 'create_test_case',
    description: 'Create a new test case with raw slide content to test the Prompt Enhancer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'A short descriptive name for the test case',
        },
        inputText: {
          type: 'string',
          description: 'The raw slide content to test',
        },
      },
      required: ['name', 'inputText'],
    },
  },
  {
    name: 'update_test_case',
    description: 'Update an existing test case.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the test case to update',
        },
        name: {
          type: 'string',
          description: 'The new name for the test case (optional)',
        },
        inputText: {
          type: 'string',
          description: 'The new input text for the test case (optional)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_test_case',
    description: 'Delete a test case.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the test case to delete',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'run_test',
    description: 'Run a single test case through the Prompt Enhancer and Image Generator pipeline. Results will appear in the UI via SSE.',
    input_schema: {
      type: 'object' as const,
      properties: {
        testCaseId: {
          type: 'string',
          description: 'The ID of the test case to run',
        },
      },
      required: ['testCaseId'],
    },
  },
  {
    name: 'run_all_tests',
    description: 'Run all test cases through the pipeline. Results will appear in the UI via SSE.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_deleted_test_cases',
    description: 'List all deleted (gravestoned) test cases. These can be restored using restore_test_case.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'restore_test_case',
    description: 'Restore a previously deleted test case. Use list_deleted_test_cases to find deleted test case IDs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the deleted test case to restore',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'keep_output_visible',
    description: 'Call this tool when your response contains important information the user needs to read, such as a question you are asking, an explanation they requested, or anything where the text output matters. By default, the chat panel auto-hides after tool operations. Calling this keeps it visible until the user dismisses it.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

/**
 * All tools available to the agent (custom + server-side).
 */
export const agentTools: (Anthropic.Messages.Tool | Anthropic.Messages.WebSearchTool20250305)[] = [
  webSearchTool,
  ...customTools,
];

interface ToolResult {
  output: string;
  isError?: boolean;
}

/**
 * Execute an agent tool and return the result.
 */
export async function executeAgentTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'get_config': {
        const config = await configStorage.getConfig();
        if (!config) {
          return { output: 'No config found', isError: true };
        }
        return {
          output: JSON.stringify({
            systemPrompt: config.systemPrompt,
            model: config.model,
            imageModel: config.imageModel,
            version: config.version,
            updatedAt: config.updatedAt,
          }, null, 2),
        };
      }

      case 'update_system_prompt': {
        const systemPrompt = input.systemPrompt as string;
        const model = (input.model as 'haiku' | 'sonnet' | 'opus') || undefined;
        const imageModel = (input.imageModel as 'gemini-2.5-flash' | 'gemini-3-pro') || undefined;
        const existingConfig = await configStorage.getConfig();

        const newVersion = (existingConfig?.version || 0) + 1;
        const now = new Date();
        const config = {
          id: existingConfig?.id || 'default',
          systemPrompt,
          model: model || existingConfig?.model || 'sonnet',
          imageModel: imageModel || existingConfig?.imageModel || 'gemini-3-pro',
          version: newVersion,
          versionName: `v${newVersion}`,
          updatedAt: now,
        };

        // Save to both config (current) and history (all versions)
        await configStorage.saveConfig(config);
        await historyStorage.saveVersion({
          version: config.version,
          versionName: config.versionName,
          systemPrompt: config.systemPrompt,
          model: config.model,
          imageModel: config.imageModel,
          savedAt: now,
        });

        // Emit SSE event
        stateEventEmitter.emit({
          type: 'config_updated',
          config,
        });

        // Create changelog entry
        await createChangelogEntry(
          'agent',
          'config_updated',
          `System prompt updated (${config.versionName})`,
          { version: config.version, versionName: config.versionName }
        );

        return { output: `Successfully updated system prompt (${config.versionName})` };
      }

      case 'list_test_cases': {
        const testCases = await testCaseStorage.listTestCases();
        if (testCases.length === 0) {
          return { output: 'No test cases found' };
        }

        // Get full test cases with input text
        const fullTestCases = await Promise.all(
          testCases.map(tc => testCaseStorage.getTestCase(tc.id))
        );

        return {
          output: JSON.stringify({
            testCases: fullTestCases.filter(Boolean).map(tc => ({
              id: tc!.id,
              name: tc!.name,
              inputText: tc!.inputText,
            })),
          }, null, 2),
        };
      }

      case 'get_test_result': {
        const testCaseId = input.testCaseId as string;
        const result = await resultStorage.getResultByTestCaseId(testCaseId);

        if (!result) {
          return { output: `No result found for test case "${testCaseId}"` };
        }

        return {
          output: JSON.stringify({
            id: result.id,
            testCaseId: result.testCaseId,
            configVersion: result.configVersion,
            status: result.status,
            enhancedPrompt: result.enhancedPrompt,
            generatedImageId: result.generatedImageId,
            imageError: result.imageError,
            runStartedAt: result.runStartedAt,
            runCompletedAt: result.runCompletedAt,
          }, null, 2),
        };
      }

      case 'create_test_case': {
        const name = input.name as string;
        const inputText = input.inputText as string;

        const testCase = {
          id: generateId(),
          name,
          inputText,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await testCaseStorage.createTestCase(testCase);

        // Emit SSE event
        stateEventEmitter.emit({
          type: 'test_case_added',
          testCase,
        });

        // Create changelog entry
        await createChangelogEntry(
          'agent',
          'test_case_created',
          `Test case "${name}" created`,
          { testCaseId: testCase.id }
        );

        return {
          output: JSON.stringify({ id: testCase.id, name, inputText }, null, 2),
        };
      }

      case 'update_test_case': {
        const id = input.id as string;
        const testCase = await testCaseStorage.getTestCase(id);

        if (!testCase) {
          return { output: `Test case "${id}" not found`, isError: true };
        }

        if (input.name !== undefined) {
          testCase.name = input.name as string;
        }
        if (input.inputText !== undefined) {
          testCase.inputText = input.inputText as string;
        }
        testCase.updatedAt = new Date();

        await testCaseStorage.updateTestCase(testCase);

        // Emit SSE event
        stateEventEmitter.emit({
          type: 'test_case_updated',
          testCase,
        });

        // Create changelog entry
        await createChangelogEntry(
          'agent',
          'test_case_updated',
          `Test case "${testCase.name}" updated`,
          { testCaseId: id }
        );

        return { output: `Successfully updated test case "${testCase.name}"` };
      }

      case 'delete_test_case': {
        const id = input.id as string;
        const testCase = await testCaseStorage.getTestCase(id);

        if (!testCase) {
          return { output: `Test case "${id}" not found`, isError: true };
        }

        await testCaseStorage.deleteTestCase(id);

        // Emit SSE event
        stateEventEmitter.emit({
          type: 'test_case_deleted',
          testCaseId: id,
        });

        // Create changelog entry
        await createChangelogEntry(
          'agent',
          'test_case_deleted',
          `Test case "${testCase.name}" deleted`,
          { testCaseId: id }
        );

        return { output: `Successfully deleted test case "${testCase.name}"` };
      }

      case 'run_test': {
        const testCaseId = input.testCaseId as string;

        try {
          const result = await testRunner.runTest(testCaseId, 'agent');
          return {
            output: JSON.stringify({
              id: result.id,
              testCaseId: result.testCaseId,
              status: result.status,
              enhancedPrompt: result.enhancedPrompt,
              generatedImageId: result.generatedImageId,
              imageError: result.imageError,
            }, null, 2),
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          return { output: `Error running test: ${message}`, isError: true };
        }
      }

      case 'run_all_tests': {
        try {
          const results = await testRunner.runAllTests('agent');
          return {
            output: JSON.stringify({
              results: results.map(r => ({
                id: r.id,
                testCaseId: r.testCaseId,
                status: r.status,
                enhancedPrompt: r.enhancedPrompt,
                generatedImageId: r.generatedImageId,
                imageError: r.imageError,
              })),
            }, null, 2),
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          return { output: `Error running tests: ${message}`, isError: true };
        }
      }

      case 'list_deleted_test_cases': {
        const deletedTestCases = await testCaseStorage.listDeletedTestCases();
        if (deletedTestCases.length === 0) {
          return { output: 'No deleted test cases found' };
        }

        return {
          output: JSON.stringify({
            deletedTestCases: deletedTestCases.map(tc => ({
              id: tc.id,
              name: tc.name,
              inputTextPreview: tc.inputTextPreview,
            })),
          }, null, 2),
        };
      }

      case 'restore_test_case': {
        const id = input.id as string;
        const testCase = await testCaseStorage.getTestCase(id);

        if (!testCase) {
          return { output: `Test case "${id}" not found`, isError: true };
        }

        if (!testCase.deletedAt) {
          return { output: `Test case "${testCase.name}" is not deleted`, isError: true };
        }

        await testCaseStorage.restoreTestCase(id);

        // Emit SSE event
        const restoredTestCase = await testCaseStorage.getTestCase(id);
        if (restoredTestCase) {
          stateEventEmitter.emit({
            type: 'test_case_added',
            testCase: restoredTestCase,
          });
        }

        // Create changelog entry
        await createChangelogEntry(
          'agent',
          'test_case_updated',
          `Test case "${testCase.name}" restored`,
          { testCaseId: id }
        );

        return { output: `Successfully restored test case "${testCase.name}"` };
      }

      case 'keep_output_visible': {
        return { output: 'Output will remain visible' };
      }

      default:
        return { output: `Unknown tool: ${toolName}`, isError: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { output: `Error executing tool: ${message}`, isError: true };
  }
}
