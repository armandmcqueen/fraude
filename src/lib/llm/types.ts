import { Message, StreamChunk, LLMOptions, ModelInfo } from '@/types';

export interface LLMProvider {
  streamMessage(
    messages: Message[],
    systemPrompt: string,
    options: LLMOptions
  ): AsyncGenerator<StreamChunk>;

  getAvailableModels(): ModelInfo[];
}
