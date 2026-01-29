import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '@/lib/config';
import { log } from '@/lib/logger';
import { JsonPersonaStorageProvider, JsonAgentSessionStorageProvider } from '@/lib/storage';
import { AgentChatSession, AgentTurn, UserTurn, AssistantTextTurn, ToolCallTurn, ToolResultTurn } from '@/types';
import { agentTools, executeAgentTool } from './tools';

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

const personaStorage = new JsonPersonaStorageProvider();
const sessionStorage = new JsonAgentSessionStorageProvider();

interface ChatRequest {
  personaId: string;
  message: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getAgentSystemPrompt(personaId: string, personaName: string): string {
  return `You are an AI assistant helping to edit a persona for a multi-persona chat application.

## Project Context
Fraude is a chat application where users can create multiple AI personas, each with their own system prompt. When users chat, multiple personas can respond to each message (sequentially or in parallel). This allows for different perspectives, debate, or specialized expertise.

## Your Role
You are helping the user edit a specific persona. You can:
- View and modify the persona's name
- View and modify the persona's system prompt
- Manage test inputs (prompts used to test how the persona responds)

## Current Persona
ID: ${personaId}
Name: ${personaName}

## Guidelines
- Be concise - the user can see the changes you make in the UI
- When editing the system prompt, preserve the user's intent and writing style
- Ask for clarification if the request is ambiguous
- After making changes, briefly confirm what you did
- Use tools to read and modify the persona data
- Test inputs are shared globally across personas. When removing a test input, prefer unlink_test_input (removes from this persona only, preserves globally). Only use delete_test_input (permanent deletion) when the user explicitly wants it gone entirely, e.g. if they're unhappy with one you just created.`;
}

/**
 * Convert our flat turn sequence into Claude's message format.
 */
function turnsToClaudeMessages(turns: AgentTurn[]): Anthropic.Messages.MessageParam[] {
  const messages: Anthropic.Messages.MessageParam[] = [];
  let currentAssistantContent: Anthropic.Messages.ContentBlockParam[] = [];
  let currentToolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

  for (const turn of turns) {
    switch (turn.type) {
      case 'user':
        // Flush any pending assistant content
        if (currentAssistantContent.length > 0) {
          messages.push({ role: 'assistant', content: currentAssistantContent });
          currentAssistantContent = [];
        }
        // Flush any pending tool results
        if (currentToolResults.length > 0) {
          messages.push({ role: 'user', content: currentToolResults });
          currentToolResults = [];
        }
        messages.push({ role: 'user', content: turn.content });
        break;

      case 'assistant_text':
        // Flush any pending tool results before adding assistant content
        if (currentToolResults.length > 0) {
          messages.push({ role: 'user', content: currentToolResults });
          currentToolResults = [];
        }
        currentAssistantContent.push({ type: 'text', text: turn.content });
        break;

      case 'tool_call':
        // Flush any pending tool results before adding to assistant content
        if (currentToolResults.length > 0) {
          messages.push({ role: 'user', content: currentToolResults });
          currentToolResults = [];
        }
        currentAssistantContent.push({
          type: 'tool_use',
          id: turn.toolUseId,
          name: turn.toolName,
          input: turn.input,
        });
        break;

      case 'tool_result':
        // Flush assistant content before tool results
        if (currentAssistantContent.length > 0) {
          messages.push({ role: 'assistant', content: currentAssistantContent });
          currentAssistantContent = [];
        }
        currentToolResults.push({
          type: 'tool_result',
          tool_use_id: turn.toolUseId,
          content: turn.output,
          is_error: turn.isError,
        });
        break;
    }
  }

  // Flush remaining content
  if (currentAssistantContent.length > 0) {
    messages.push({ role: 'assistant', content: currentAssistantContent });
  }
  if (currentToolResults.length > 0) {
    messages.push({ role: 'user', content: currentToolResults });
  }

  return messages;
}

export async function POST(request: NextRequest) {
  const { personaId, message }: ChatRequest = await request.json();

  // Get persona
  const persona = await personaStorage.getPersona(personaId);
  if (!persona) {
    return new Response(JSON.stringify({ error: 'Persona not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get or create session
  let session: AgentChatSession;
  if (persona.agentChatSessionId) {
    const existingSession = await sessionStorage.getSession(persona.agentChatSessionId);
    if (existingSession) {
      session = existingSession;
    } else {
      // Session was deleted, create new one
      session = {
        id: generateId(),
        personaId,
        turns: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  } else {
    // Create new session
    session = {
      id: generateId(),
      personaId,
      turns: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // Add user turn
  const userTurn: UserTurn = {
    type: 'user',
    id: generateId(),
    content: message,
    createdAt: new Date(),
  };
  session.turns.push(userTurn);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // Agent loop - continues until end_turn
        let continueLoop = true;

        while (continueLoop) {
          const claudeMessages = turnsToClaudeMessages(session.turns);

          const response = await anthropic.messages.create({
            model: config.defaultModel,
            max_tokens: 4096,
            system: getAgentSystemPrompt(personaId, persona.name),
            messages: claudeMessages,
            tools: agentTools,
            stream: true,
          });

          let currentTextContent = '';
          let currentTextId = '';
          const toolCalls: { id: string; toolUseId: string; name: string; input: Record<string, unknown> }[] = [];
          let currentToolInput = '';
          let currentToolName = '';
          let currentToolUseId = '';

          for await (const event of response) {
            if (event.type === 'content_block_start') {
              if (event.content_block.type === 'text') {
                currentTextId = generateId();
                currentTextContent = '';
              } else if (event.content_block.type === 'tool_use') {
                currentToolUseId = event.content_block.id;
                currentToolName = event.content_block.name;
                currentToolInput = '';
              }
            } else if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                currentTextContent += event.delta.text;
                sendEvent({ type: 'text_delta', content: event.delta.text });
              } else if (event.delta.type === 'input_json_delta') {
                currentToolInput += event.delta.partial_json;
              }
            } else if (event.type === 'content_block_stop') {
              // Finalize text block
              if (currentTextContent) {
                const textTurn: AssistantTextTurn = {
                  type: 'assistant_text',
                  id: currentTextId,
                  content: currentTextContent,
                  createdAt: new Date(),
                };
                session.turns.push(textTurn);
                sendEvent({ type: 'text_complete', id: currentTextId, content: currentTextContent });
                currentTextContent = '';
              }
              // Finalize tool call
              if (currentToolName) {
                let input: Record<string, unknown> = {};
                try {
                  input = currentToolInput ? JSON.parse(currentToolInput) : {};
                } catch {
                  input = {};
                }
                const toolCallId = generateId();
                toolCalls.push({ id: toolCallId, toolUseId: currentToolUseId, name: currentToolName, input });

                const toolCallTurn: ToolCallTurn = {
                  type: 'tool_call',
                  id: toolCallId,
                  toolUseId: currentToolUseId,
                  toolName: currentToolName,
                  input,
                  createdAt: new Date(),
                };
                session.turns.push(toolCallTurn);
                sendEvent({ type: 'tool_call', id: toolCallId, toolUseId: currentToolUseId, toolName: currentToolName, input });

                currentToolName = '';
                currentToolUseId = '';
                currentToolInput = '';
              }
            } else if (event.type === 'message_stop') {
              // Check stop reason from the accumulated message
            } else if (event.type === 'message_delta') {
              if (event.delta.stop_reason === 'end_turn') {
                continueLoop = false;
              } else if (event.delta.stop_reason === 'tool_use') {
                // Execute tools and continue loop
                for (const toolCall of toolCalls) {
                  const result = await executeAgentTool(toolCall.name, toolCall.input, personaId);
                  const toolResultTurn: ToolResultTurn = {
                    type: 'tool_result',
                    id: generateId(),
                    toolUseId: toolCall.toolUseId,
                    output: result.output,
                    isError: result.isError,
                    createdAt: new Date(),
                  };
                  session.turns.push(toolResultTurn);
                  sendEvent({
                    type: 'tool_result',
                    id: toolResultTurn.id,
                    toolUseId: toolCall.toolUseId,
                    output: result.output,
                    isError: result.isError,
                  });
                }
                toolCalls.length = 0; // Clear for next iteration
              }
            }
          }
        }

        // Save session
        session.updatedAt = new Date();
        await sessionStorage.saveSession(session);

        // Update persona with session ID if needed
        if (persona.agentChatSessionId !== session.id) {
          // Re-fetch persona in case tools modified it
          const currentPersona = await personaStorage.getPersona(personaId);
          if (currentPersona) {
            currentPersona.agentChatSessionId = session.id;
            currentPersona.updatedAt = new Date();
            await personaStorage.updatePersona(currentPersona);
          }
        }

        sendEvent({ type: 'done' });
      } catch (error) {
        log.error('Persona agent error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        sendEvent({ type: 'error', message: errorMessage });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
