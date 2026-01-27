import { Message, StreamChunk, LLMOptions, ModelInfo } from '@/types';
import { availableModels } from '@/lib/config';

/**
 * Client-side LLM client that calls Next.js API routes.
 * This is the ONLY LLM client used on the client side.
 * Keeps API keys secure on the server.
 */
export class APILLMClient {
  private chatEndpoint: string;
  private completeEndpoint: string;

  constructor(options?: { chatEndpoint?: string; completeEndpoint?: string }) {
    this.chatEndpoint = options?.chatEndpoint || '/api/chat';
    this.completeEndpoint = options?.completeEndpoint || '/api/complete';
  }

  /**
   * Stream a chat completion from the server.
   * @param signal Optional AbortSignal to cancel the request
   */
  async *streamChat(
    conversationId: string,
    messages: Message[],
    systemPrompt: string,
    options: LLMOptions,
    signal?: AbortSignal
  ): AsyncGenerator<StreamChunk> {
    const response = await fetch(this.chatEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        messages,
        systemPrompt,
        options,
      }),
      signal,
    });

    if (!response.ok) {
      yield { type: 'error', error: `HTTP ${response.status}: ${response.statusText}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk: StreamChunk = JSON.parse(line);
              yield chunk;
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const chunk: StreamChunk = JSON.parse(buffer);
          yield chunk;
        } catch {
          // Skip invalid JSON
        }
      }
    } finally {
      // Release the reader lock when done or cancelled
      reader.releaseLock();
    }
  }

  /**
   * Get a non-streaming completion from the server.
   */
  async complete(
    conversationId: string,
    systemPrompt: string,
    userPrompt: string,
    options: LLMOptions
  ): Promise<string> {
    const response = await fetch(this.completeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        systemPrompt,
        userPrompt,
        options,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content;
  }

  /**
   * Get list of available models.
   */
  getAvailableModels(): ModelInfo[] {
    return [...availableModels];
  }
}
