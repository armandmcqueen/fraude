import Anthropic from '@anthropic-ai/sdk';
import { Message, StreamChunk, LLMOptions, ModelInfo } from '@/types';
import { LLMProvider } from './types';
import { config, availableModels } from '../config';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || config.anthropicApiKey,
    });
  }

  async *streamMessage(
    messages: Message[],
    systemPrompt: string,
    options: LLMOptions
  ): AsyncGenerator<StreamChunk> {
    const anthropicMessages = messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    try {
      const stream = this.client.messages.stream({
        model: options.model,
        max_tokens: options.maxTokens || 4096,
        system: systemPrompt,
        messages: anthropicMessages,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield {
            type: 'text',
            content: event.delta.text,
          };
        }
      }

      yield { type: 'done' };
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getAvailableModels(): ModelInfo[] {
    return [...availableModels];
  }
}
