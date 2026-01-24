import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, getServerUrl, waitForServer } from './server-utils';

// We can't import the services directly because they use @/ paths
// Instead, we'll make direct HTTP calls similar to what APILLMClient does

describe('Live LLM Tests', () => {
  beforeAll(async () => {
    await startServer();
    await waitForServer();
  }, 60000); // 60s timeout for server startup

  afterAll(async () => {
    await stopServer();
  });

  it('should answer a simple factual question about England capital', async () => {
    const serverUrl = getServerUrl();

    const conversationId = `test-${Date.now()}`;
    const userMessage = 'What is the capital of England?';

    const systemPrompt =
      'You are a helpful assistant. Answer questions directly and concisely.';

    const response = await fetch(`${serverUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        messages: [
          {
            id: '1',
            role: 'user',
            content: userMessage,
            createdAt: new Date().toISOString(),
          },
        ],
        systemPrompt,
        options: {
          model: 'claude-sonnet-4-5-20250929',
          maxTokens: 1024,
        },
      }),
    });

    expect(response.ok).toBe(true);

    // Read the streaming response
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const chunk = JSON.parse(line);
            if (chunk.type === 'text' && chunk.content) {
              fullContent += chunk.content;
            } else if (chunk.type === 'error') {
              console.error('LLM Error:', chunk.error);
              throw new Error(chunk.error);
            } else if (chunk.type === 'done') {
              // Stream complete
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue; // Skip invalid JSON
            throw e;
          }
        }
      }
    }

    console.log('Response:', fullContent);

    // Assert the response mentions London (case insensitive)
    const lowerContent = fullContent.toLowerCase();
    expect(
      lowerContent.includes('london'),
      `Response should mention London. Got: ${fullContent}`
    ).toBe(true);
  }, 30000); // 30s timeout for LLM response
});
