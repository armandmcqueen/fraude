import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '@/lib/config';
import { log } from '@/lib/logger';
import {
  JsonEvalAgentSessionStorageProvider,
  JsonEvalChangelogStorageProvider,
} from '@/lib/storage';
import {
  SlidegenEvalAgentSession,
  SlidegenEvalAgentTurn,
  SlidegenEvalUserTurn,
  SlidegenEvalAssistantTextTurn,
  SlidegenEvalToolCallTurn,
  SlidegenEvalToolResultTurn,
  ChangelogEntry,
} from '@/types/slidegen-eval';
import { agentTools, executeAgentTool } from './tools';

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

const sessionStorage = new JsonEvalAgentSessionStorageProvider();
const changelogStorage = new JsonEvalChangelogStorageProvider();

// We use a single session ID for the slidegen eval agent
const EVAL_SESSION_ID = 'slidegen-eval-session';

interface ChatRequest {
  message: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format changelog entries for injection into the system prompt.
 */
function formatChangelogForPrompt(entries: ChangelogEntry[]): string {
  if (entries.length === 0) {
    return '';
  }

  const formatted = entries.map((entry) => {
    const timeAgo = getTimeAgo(entry.timestamp);
    const source = entry.source === 'ui' ? 'UI' : 'Agent';
    return `- ${timeAgo} (${source}): ${entry.summary}`;
  }).join('\n');

  return `\n\n[RECENT CHANGES SINCE YOUR LAST TURN]\n${formatted}`;
}

/**
 * Get a human-readable time ago string.
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

function getAgentSystemPrompt(changelogSection: string): string {
  return `You are an assistant helping to iterate on a Prompt Enhancer system prompt.
The Prompt Enhancer takes raw slide content and transforms it into an image
generation prompt for creating presentation slides.

## Your Capabilities
You can:
- Read and modify the system prompt
- Create, edit, and delete test cases
- Run tests to see how the prompt performs
- Have conversations about prompt engineering strategies
- Search the web for information about prompt engineering

## Guidelines
- Be concise - the user can see changes you make in the UI
- When editing the system prompt, preserve the user's intent and writing style
- Test results include the enhanced prompt (your system prompt's output) and
  the generated image. Focus on whether the enhanced prompts produce good
  slide imagery.
- After making changes to the system prompt, consider running tests to verify
  the behavior.
- When you make changes, they are immediately visible in the UI.
- When the user makes changes in the UI, you'll see them in the [RECENT CHANGES] section.
${changelogSection}`;
}

/**
 * Convert our flat turn sequence into Claude's message format.
 */
function turnsToClaudeMessages(turns: SlidegenEvalAgentTurn[]): Anthropic.Messages.MessageParam[] {
  const messages: Anthropic.Messages.MessageParam[] = [];
  let currentAssistantContent: Anthropic.Messages.ContentBlockParam[] = [];
  let currentUserContent: Anthropic.Messages.ToolResultBlockParam[] = [];

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
  const { message }: ChatRequest = await request.json();

  // Get or create session
  let session = await sessionStorage.getSession(EVAL_SESSION_ID);
  if (!session) {
    session = {
      id: EVAL_SESSION_ID,
      turns: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // Get changelog entries since last seen
  const recentChanges = await changelogStorage.getEntries(session.lastSeenChangelogId);
  const changelogSection = formatChangelogForPrompt(recentChanges);

  // Update lastSeenChangelogId to current latest
  const latestChangelogId = await changelogStorage.getLatestId();
  if (latestChangelogId) {
    session.lastSeenChangelogId = latestChangelogId;
  }

  // Add user turn
  const userTurn: SlidegenEvalUserTurn = {
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
          const systemPrompt = getAgentSystemPrompt(changelogSection);

          log.info('[slidegen-eval-agent] Sending to Claude:', { messageCount: claudeMessages.length });

          const response = await anthropic.messages.create({
            model: config.defaultModel,
            max_tokens: 4096,
            system: systemPrompt,
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
                if (!currentTextId) {
                  currentTextId = generateId();
                }
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
              // Finalize tool call
              if (currentToolName) {
                // Flush accumulated text BEFORE the tool call to maintain order
                if (currentTextContent) {
                  const textTurn: SlidegenEvalAssistantTextTurn = {
                    type: 'assistant_text',
                    id: currentTextId,
                    content: currentTextContent,
                    createdAt: new Date(),
                  };
                  session.turns.push(textTurn);
                  sendEvent({ type: 'text_complete', id: currentTextId, content: currentTextContent });
                  currentTextContent = '';
                  currentTextId = '';
                }

                let input: Record<string, unknown> = {};
                try {
                  input = currentToolInput ? JSON.parse(currentToolInput) : {};
                } catch {
                  input = {};
                }
                const toolCallId = generateId();
                toolCalls.push({ id: toolCallId, toolUseId: currentToolUseId, name: currentToolName, input });

                const toolCallTurn: SlidegenEvalToolCallTurn = {
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
            } else if (event.type === 'message_delta') {
              if (event.delta.stop_reason === 'end_turn') {
                continueLoop = false;
              } else if (event.delta.stop_reason === 'tool_use') {
                // Execute tools and continue loop
                for (const toolCall of toolCalls) {
                  const result = await executeAgentTool(toolCall.name, toolCall.input);
                  const toolResultTurn: SlidegenEvalToolResultTurn = {
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

          // Flush any remaining accumulated text at the end of this API call
          if (currentTextContent) {
            const textTurn: SlidegenEvalAssistantTextTurn = {
              type: 'assistant_text',
              id: currentTextId,
              content: currentTextContent,
              createdAt: new Date(),
            };
            session.turns.push(textTurn);
            sendEvent({ type: 'text_complete', id: currentTextId, content: currentTextContent });
            currentTextContent = '';
            currentTextId = '';
          }
        }

        // Save session
        session.updatedAt = new Date();
        await sessionStorage.saveSession(session);

        sendEvent({ type: 'done' });
      } catch (error) {
        log.error('[slidegen-eval-agent] Error:', error);
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
