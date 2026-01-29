import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '@/lib/config';
import { log } from '@/lib/logger';
import { JsonPersonaStorageProvider, JsonAgentSessionStorageProvider } from '@/lib/storage';
import { AgentChatSession, AgentTurn, UserTurn, AssistantTextTurn, ToolCallTurn, ToolResultTurn, ServerToolUseTurn, WebSearchResultTurn, WebSearchResult } from '@/types';
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
- Search the web for information to help build better personas

## Current Persona
ID: ${personaId}
Name: ${personaName}

## Guidelines
- Be concise - the user can see the changes you make in the UI
- When editing the system prompt, preserve the user's intent and writing style
- Ask for clarification if the request is ambiguous
- After making changes, briefly confirm what you did
- Use tools to read and modify the persona data
- Test inputs are shared globally across personas. When removing a test input, prefer unlink_test_input (removes from this persona only, preserves globally). Only use delete_test_input (permanent deletion) when the user explicitly wants it gone entirely, e.g. if they're unhappy with one you just created.
- You have access to web search - use it when you need current information or want to research best practices for creating effective personas.`;
}

/**
 * Convert our flat turn sequence into Claude's message format.
 */
function turnsToClaudeMessages(turns: AgentTurn[]): Anthropic.Messages.MessageParam[] {
  const messages: Anthropic.Messages.MessageParam[] = [];
  let currentAssistantContent: Anthropic.Messages.ContentBlockParam[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentUserContent: any[] = [];  // Can include tool_result and web_search_tool_result

  for (const turn of turns) {
    switch (turn.type) {
      case 'user':
        // Flush any pending assistant content
        if (currentAssistantContent.length > 0) {
          messages.push({ role: 'assistant', content: currentAssistantContent });
          currentAssistantContent = [];
        }
        // Flush any pending user content (tool results)
        if (currentUserContent.length > 0) {
          messages.push({ role: 'user', content: currentUserContent });
          currentUserContent = [];
        }
        messages.push({ role: 'user', content: turn.content });
        break;

      case 'assistant_text':
        // Flush any pending user content before adding assistant content
        if (currentUserContent.length > 0) {
          messages.push({ role: 'user', content: currentUserContent });
          currentUserContent = [];
        }
        currentAssistantContent.push({ type: 'text', text: turn.content });
        break;

      case 'tool_call':
        // Flush any pending user content before adding to assistant content
        if (currentUserContent.length > 0) {
          messages.push({ role: 'user', content: currentUserContent });
          currentUserContent = [];
        }
        currentAssistantContent.push({
          type: 'tool_use',
          id: turn.toolUseId,
          name: turn.toolName,
          input: turn.input,
        });
        break;

      case 'server_tool_use':
        // Server tool use (like web_search) goes in assistant content
        if (currentUserContent.length > 0) {
          messages.push({ role: 'user', content: currentUserContent });
          currentUserContent = [];
        }
        currentAssistantContent.push({
          type: 'server_tool_use',
          id: turn.toolUseId,
          name: turn.toolName as 'web_search',  // Currently only web_search is supported
          input: turn.input,
        });
        break;

      case 'tool_result':
        // Flush assistant content before tool results
        if (currentAssistantContent.length > 0) {
          messages.push({ role: 'assistant', content: currentAssistantContent });
          currentAssistantContent = [];
        }
        currentUserContent.push({
          type: 'tool_result',
          tool_use_id: turn.toolUseId,
          content: turn.output,
          is_error: turn.isError,
        });
        break;

      case 'web_search_result':
        // Flush assistant content before web search results
        if (currentAssistantContent.length > 0) {
          messages.push({ role: 'assistant', content: currentAssistantContent });
          currentAssistantContent = [];
        }
        // Web search results go in user content
        if (turn.error) {
          currentUserContent.push({
            type: 'web_search_tool_result',
            tool_use_id: turn.toolUseId,
            content: {
              type: 'web_search_tool_result_error',
              error_code: turn.error.errorCode,
            },
          });
        } else {
          currentUserContent.push({
            type: 'web_search_tool_result',
            tool_use_id: turn.toolUseId,
            content: turn.results.map((r) => ({
              type: 'web_search_result',
              url: r.url,
              title: r.title,
              encrypted_content: r.encryptedContent,
              page_age: r.pageAge,
            })),
          });
        }
        break;
    }
  }

  // Flush remaining content
  if (currentAssistantContent.length > 0) {
    messages.push({ role: 'assistant', content: currentAssistantContent });
  }
  if (currentUserContent.length > 0) {
    messages.push({ role: 'user', content: currentUserContent });
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
          let isServerTool = false;  // Track if current tool is server-side

          for await (const event of response) {
            if (event.type === 'content_block_start') {
              if (event.content_block.type === 'text') {
                currentTextId = generateId();
                currentTextContent = '';
              } else if (event.content_block.type === 'tool_use') {
                currentToolUseId = event.content_block.id;
                currentToolName = event.content_block.name;
                currentToolInput = '';
                isServerTool = false;
              } else if (event.content_block.type === 'server_tool_use') {
                // Server-side tool (like web_search) - executed by Anthropic
                currentToolUseId = event.content_block.id;
                currentToolName = event.content_block.name;
                currentToolInput = '';
                isServerTool = true;
              } else if (event.content_block.type === 'web_search_tool_result') {
                // Web search results from Anthropic's servers
                const webSearchBlock = event.content_block as Anthropic.Messages.WebSearchToolResultBlock;
                const turnId = generateId();
                const content = webSearchBlock.content;

                // Check if it's an error or results
                if (!Array.isArray(content) && 'error_code' in content) {
                  const errorContent = content as { type: string; error_code: string };
                  const webSearchTurn: WebSearchResultTurn = {
                    type: 'web_search_result',
                    id: turnId,
                    toolUseId: webSearchBlock.tool_use_id,
                    results: [],
                    error: {
                      type: 'web_search_tool_result_error',
                      errorCode: errorContent.error_code,
                    },
                    createdAt: new Date(),
                  };
                  session.turns.push(webSearchTurn);
                  sendEvent({
                    type: 'web_search_result',
                    id: turnId,
                    toolUseId: webSearchBlock.tool_use_id,
                    results: [],
                    error: webSearchTurn.error,
                  });
                } else if (Array.isArray(content)) {
                  // It's an array of results
                  const resultsArray = content as Anthropic.Messages.WebSearchResultBlock[];
                  const results: WebSearchResult[] = resultsArray.map((r) => ({
                    type: 'web_search_result' as const,
                    url: r.url,
                    title: r.title,
                    encryptedContent: r.encrypted_content,
                    pageAge: r.page_age ?? undefined,
                  }));

                  const webSearchTurn: WebSearchResultTurn = {
                    type: 'web_search_result',
                    id: turnId,
                    toolUseId: webSearchBlock.tool_use_id,
                    results,
                    createdAt: new Date(),
                  };
                  session.turns.push(webSearchTurn);
                  sendEvent({
                    type: 'web_search_result',
                    id: turnId,
                    toolUseId: webSearchBlock.tool_use_id,
                    results,
                  });
                }
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
              // Finalize tool call (custom tools only - server tools are handled differently)
              if (currentToolName && !isServerTool) {
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
              } else if (currentToolName && isServerTool) {
                // Server tool use - record it but don't execute (Anthropic executes it)
                let input: Record<string, unknown> = {};
                try {
                  input = currentToolInput ? JSON.parse(currentToolInput) : {};
                } catch {
                  input = {};
                }
                const serverToolId = generateId();

                const serverToolTurn: ServerToolUseTurn = {
                  type: 'server_tool_use',
                  id: serverToolId,
                  toolUseId: currentToolUseId,
                  toolName: currentToolName,
                  input,
                  createdAt: new Date(),
                };
                session.turns.push(serverToolTurn);
                sendEvent({ type: 'server_tool_use', id: serverToolId, toolUseId: currentToolUseId, toolName: currentToolName, input });

                currentToolName = '';
                currentToolUseId = '';
                currentToolInput = '';
                isServerTool = false;
              }
            } else if (event.type === 'message_stop') {
              // Check stop reason from the accumulated message
            } else if (event.type === 'message_delta') {
              if (event.delta.stop_reason === 'end_turn') {
                continueLoop = false;
              } else if (event.delta.stop_reason === 'pause_turn') {
                // Server is pausing a long-running turn - continue the loop to resume
                // No custom tools to execute, just continue
              } else if (event.delta.stop_reason === 'tool_use') {
                // Execute custom tools and continue loop (server tools already executed by Anthropic)
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
