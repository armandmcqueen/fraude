import Anthropic from '@anthropic-ai/sdk';
import { JsonPersonaStorageProvider, JsonTestInputStorageProvider } from '@/lib/storage';
import { TestInput } from '@/types';

const personaStorage = new JsonPersonaStorageProvider();
const testInputStorage = new JsonTestInputStorageProvider();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Tool definitions for the persona editor agent.
 */
export const agentTools: Anthropic.Messages.Tool[] = [
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

      default:
        return { output: `Unknown tool: ${toolName}`, isError: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { output: `Error executing tool: ${message}`, isError: true };
  }
}
