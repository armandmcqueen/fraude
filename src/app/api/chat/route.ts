import { NextRequest } from 'next/server';
import { AnthropicProvider } from '@/lib/llm';
import { DefaultPromptProvider } from '@/lib/prompt';
import { Message, LLMOptions } from '@/types';

const llmProvider = new AnthropicProvider();
const promptProvider = new DefaultPromptProvider();

export async function POST(request: NextRequest) {
  const { messages, options }: { messages: Message[]; options: LLMOptions } =
    await request.json();

  const systemPrompt = await promptProvider.getSystemPrompt({
    model: options.model,
  });

  // Create a streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of llmProvider.streamMessage(
          messages,
          systemPrompt,
          options
        )) {
          const data = JSON.stringify(chunk) + '\n';
          controller.enqueue(encoder.encode(data));
        }
      } catch (error) {
        const errorChunk = JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        controller.enqueue(encoder.encode(errorChunk + '\n'));
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
