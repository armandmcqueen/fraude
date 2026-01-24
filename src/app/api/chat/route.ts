import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Message, LLMOptions } from '@/types';
import { config } from '@/lib/config';
import { log } from '@/lib/logger';
import { createCallRecorder } from '@/lib/llm-recorder';

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

interface ChatRequest {
  conversationId: string;
  messages: Message[];
  systemPrompt: string;
  options: LLMOptions;
}

export async function POST(request: NextRequest) {
  const { conversationId, messages, systemPrompt, options }: ChatRequest =
    await request.json();

  const anthropicMessages = messages.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  const recorder = createCallRecorder(
    'chat',
    conversationId,
    options.model,
    systemPrompt,
    anthropicMessages,
    { maxTokens: options.maxTokens || 4096 }
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      try {
        const anthropicStream = anthropic.messages.stream({
          model: options.model,
          max_tokens: options.maxTokens || 4096,
          system: systemPrompt,
          messages: anthropicMessages,
        });

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            fullResponse += event.delta.text;
            const chunk = JSON.stringify({
              type: 'text',
              content: event.delta.text,
            }) + '\n';
            controller.enqueue(encoder.encode(chunk));
          }
        }

        controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
        recorder.success(fullResponse);
      } catch (error) {
        log.error('Chat API error:', error);
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
          if ('cause' in error && error.cause) {
            errorMessage += ` (cause: ${error.cause})`;
          }
        }
        const errorChunk = JSON.stringify({
          type: 'error',
          error: errorMessage,
        }) + '\n';
        controller.enqueue(encoder.encode(errorChunk));
        recorder.failure(errorMessage);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
