import Anthropic from '@anthropic-ai/sdk';
import { JsonPersonaStorageProvider, JsonTestInputStorageProvider } from '@/lib/storage';
import { TestInput } from '@/types';

const personaStorage = new JsonPersonaStorageProvider();
const testInputStorage = new JsonTestInputStorageProvider();

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
  max_uses: 5,  // Limit searches per request
};

/**
 * Custom tool definitions for the persona editor agent.
 */
export const customTools: Anthropic.Messages.Tool[] = [
  {
    name: 'get_persona',
    description: 'Get the current persona data including name, system prompt, and test input IDs.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_all_personas',
    description: 'List all personas in the system. Returns id and name for each persona. Use this to see what other personas exist that you might reference.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'inspect_persona',
    description: 'View another persona\'s details (read-only). Use this to reference other personas when building or improving the current persona. You cannot edit other personas with this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        personaId: {
          type: 'string',
          description: 'The ID of the persona to inspect',
        },
      },
      required: ['personaId'],
    },
  },
  {
    name: 'update_persona_name',
    description: 'Update the persona\'s display name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'The new name for the persona',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_system_prompt',
    description: 'Update the persona\'s system prompt. This replaces the entire system prompt.',
    input_schema: {
      type: 'object' as const,
      properties: {
        systemPrompt: {
          type: 'string',
          description: 'The new system prompt for the persona',
        },
      },
      required: ['systemPrompt'],
    },
  },
  {
    name: 'list_test_inputs',
    description: 'List all test inputs associated with this persona.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_test_input',
    description: 'Get a specific test input by ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the test input to retrieve',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_test_input',
    description: 'Create a new test input and link it to this persona.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: {
          type: 'string',
          description: 'The content of the test input (the test prompt)',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'update_test_input',
    description: 'Update an existing test input\'s content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the test input to update',
        },
        content: {
          type: 'string',
          description: 'The new content for the test input',
        },
      },
      required: ['id', 'content'],
    },
  },
  {
    name: 'unlink_test_input',
    description: 'Remove a test input from this persona. The test input will still exist globally and can be linked to other personas. Use this in most cases when the user wants to remove a test input.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the test input to unlink from this persona',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_test_input',
    description: 'Permanently delete a test input from the system. This removes it globally - it will no longer be available to any persona. Only use this when the user explicitly wants to delete the test input entirely, such as when they are unhappy with one you just created.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the test input to permanently delete',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'keep_output_visible',
    description: 'Call this tool when your response contains important information the user needs to read, such as a question you are asking, an explanation they requested, or anything where the text output matters. By default, the chat panel auto-hides after tool operations. Calling this keeps it visible until the user dismisses it. Do NOT call this for routine confirmations like "I updated the system prompt" - only for responses where the user needs to read and consider your message.',
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
  input: Record<string, unknown>,
  personaId: string
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'get_persona': {
        const persona = await personaStorage.getPersona(personaId);
        if (!persona) {
          return { output: 'Persona not found', isError: true };
        }
        return {
          output: JSON.stringify({
            name: persona.name,
            systemPrompt: persona.systemPrompt,
            testInputIds: persona.testInputIds,
          }, null, 2),
        };
      }

      case 'list_all_personas': {
        const allPersonas = await personaStorage.listPersonas();
        const currentPersona = await personaStorage.getPersona(personaId);
        const result = allPersonas.map((p) => ({
          id: p.id,
          name: p.name,
          isCurrentPersona: p.id === personaId,
        }));
        return {
          output: JSON.stringify({
            currentPersonaId: personaId,
            currentPersonaName: currentPersona?.name || 'Unknown',
            personas: result,
          }, null, 2),
        };
      }

      case 'inspect_persona': {
        const targetId = input.personaId as string;
        if (targetId === personaId) {
          return { output: 'Use get_persona to view the current persona instead.', isError: true };
        }
        const targetPersona = await personaStorage.getPersona(targetId);
        if (!targetPersona) {
          return { output: `Persona with ID "${targetId}" not found`, isError: true };
        }
        return {
          output: JSON.stringify({
            id: targetPersona.id,
            name: targetPersona.name,
            systemPrompt: targetPersona.systemPrompt,
            testInputIds: targetPersona.testInputIds,
            note: 'This is a read-only view. You cannot edit this persona.',
          }, null, 2),
        };
      }

      case 'update_persona_name': {
        const name = input.name as string;
        const persona = await personaStorage.getPersona(personaId);
        if (!persona) {
          return { output: 'Persona not found', isError: true };
        }
        persona.name = name;
        persona.updatedAt = new Date();
        await personaStorage.updatePersona(persona);
        return { output: `Successfully updated persona name to "${name}"` };
      }

      case 'update_system_prompt': {
        const systemPrompt = input.systemPrompt as string;
        const persona = await personaStorage.getPersona(personaId);
        if (!persona) {
          return { output: 'Persona not found', isError: true };
        }
        persona.systemPrompt = systemPrompt;
        persona.updatedAt = new Date();
        await personaStorage.updatePersona(persona);
        return { output: 'Successfully updated system prompt' };
      }

      case 'list_test_inputs': {
        const persona = await personaStorage.getPersona(personaId);
        if (!persona) {
          return { output: 'Persona not found', isError: true };
        }
        const testInputs = [];
        for (const testInputId of persona.testInputIds) {
          const testInput = await testInputStorage.getTestInput(testInputId);
          if (testInput) {
            testInputs.push({ id: testInput.id, content: testInput.content });
          }
        }
        if (testInputs.length === 0) {
          return { output: 'No test inputs configured for this persona' };
        }
        return { output: JSON.stringify({ testInputs }, null, 2) };
      }

      case 'get_test_input': {
        const id = input.id as string;
        const testInput = await testInputStorage.getTestInput(id);
        if (!testInput) {
          return { output: `Test input with ID "${id}" not found`, isError: true };
        }
        return { output: JSON.stringify({ id: testInput.id, content: testInput.content }, null, 2) };
      }

      case 'create_test_input': {
        const content = input.content as string;
        const persona = await personaStorage.getPersona(personaId);
        if (!persona) {
          return { output: 'Persona not found', isError: true };
        }

        const testInput: TestInput = {
          id: generateId(),
          content,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await testInputStorage.createTestInput(testInput);

        // Link to persona
        persona.testInputIds.push(testInput.id);
        persona.updatedAt = new Date();
        await personaStorage.updatePersona(persona);

        return { output: JSON.stringify({ id: testInput.id, content: testInput.content }, null, 2) };
      }

      case 'update_test_input': {
        const id = input.id as string;
        const content = input.content as string;
        const testInput = await testInputStorage.getTestInput(id);
        if (!testInput) {
          return { output: `Test input with ID "${id}" not found`, isError: true };
        }
        testInput.content = content;
        testInput.updatedAt = new Date();
        await testInputStorage.updateTestInput(testInput);
        return { output: `Successfully updated test input "${id}"` };
      }

      case 'unlink_test_input': {
        const id = input.id as string;
        const persona = await personaStorage.getPersona(personaId);
        if (!persona) {
          return { output: 'Persona not found', isError: true };
        }

        // Check if it's actually linked
        if (!persona.testInputIds.includes(id)) {
          return { output: `Test input "${id}" is not linked to this persona`, isError: true };
        }

        // Remove from persona's list (test input remains globally)
        persona.testInputIds = persona.testInputIds.filter((tid) => tid !== id);
        persona.updatedAt = new Date();
        await personaStorage.updatePersona(persona);

        return { output: `Successfully unlinked test input "${id}" from this persona` };
      }

      case 'delete_test_input': {
        const id = input.id as string;
        const persona = await personaStorage.getPersona(personaId);
        if (!persona) {
          return { output: 'Persona not found', isError: true };
        }

        // Remove from persona's list if linked
        if (persona.testInputIds.includes(id)) {
          persona.testInputIds = persona.testInputIds.filter((tid) => tid !== id);
          persona.updatedAt = new Date();
          await personaStorage.updatePersona(persona);
        }

        // Permanently delete the test input
        await testInputStorage.deleteTestInput(id);

        return { output: `Successfully deleted test input "${id}" permanently` };
      }

      case 'keep_output_visible': {
        // This is a client-side signal - no server action needed
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
