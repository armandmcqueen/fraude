import { describe, it, expect } from 'vitest';
import { getServerUrl } from './server-utils';
import { MultiPersonaChatSession } from '@/services/MultiActorChatSession';
import { TitleService } from '@/services/TitleService';
import { SummaryService, SUMMARY_THRESHOLD } from '@/services/SummaryService';
import { APILLMClient } from '@/services/llm/APILLMClient';
import { APIStorageClient } from '@/services/storage/APIStorageClient';
import { sequentialOrchestrator } from '@/services/orchestration';

describe('Summary Integration', () => {
  it('should generate summary for long persona responses', async () => {
    const serverUrl = getServerUrl();
    const llmClient = new APILLMClient({
      chatEndpoint: `${serverUrl}/api/chat`,
      completeEndpoint: `${serverUrl}/api/complete`,
    });
    const storageClient = new APIStorageClient(`${serverUrl}/api/storage/conversations`);
    const titleService = new TitleService(llmClient);
    const summaryService = new SummaryService(llmClient);

    const session = new MultiPersonaChatSession({
      llmClient,
      storageClient,
      titleService,
      summaryService,
      personas: [
        {
          id: 'detailed-responder',
          name: 'Detailed Responder',
          // Ask for a specific length to ensure we exceed the threshold
          systemPrompt: 'Always respond with at least 600 characters of content. Be thorough but not excessively long.',
        },
      ],
      orchestrator: sequentialOrchestrator,
    });

    session.createNewConversation();

    // Send a message that should get a long-enough response
    await session.sendMessage('What are the main benefits of exercise?');

    const conv = session.getConversation();
    expect(conv).not.toBeNull();
    expect(conv!.messages.length).toBe(2);

    const userMessage = conv!.messages[0];
    const assistantMessage = conv!.messages[1];

    // User message should not have a summary
    expect(userMessage.role).toBe('user');
    expect(userMessage.summary).toBeUndefined();

    // Assistant message should have content
    expect(assistantMessage.role).toBe('assistant');
    console.log('Response length:', assistantMessage.content.length);

    // Only check summary if response was long enough
    if (assistantMessage.content.length >= SUMMARY_THRESHOLD) {
      console.log('Summary:', assistantMessage.summary);

      expect(assistantMessage.summary).toBeDefined();
      expect(assistantMessage.summary!.length).toBeGreaterThan(0);
      expect(assistantMessage.summary!.length).toBeLessThan(assistantMessage.content.length);
      expect(assistantMessage.summaryModel).toBeDefined();
      expect(assistantMessage.summaryGeneratedAt).toBeDefined();

      // Verify it was saved to storage
      const loaded = await storageClient.getConversation(conv!.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.messages[1].summary).toBe(assistantMessage.summary);
    } else {
      console.log('Response was shorter than threshold, skipping summary check');
      expect(assistantMessage.summary).toBeUndefined();
    }
  }, 90000);

  it('should NOT generate summary for short responses', async () => {
    const serverUrl = getServerUrl();
    const llmClient = new APILLMClient({
      chatEndpoint: `${serverUrl}/api/chat`,
      completeEndpoint: `${serverUrl}/api/complete`,
    });
    const storageClient = new APIStorageClient(`${serverUrl}/api/storage/conversations`);
    const titleService = new TitleService(llmClient);
    const summaryService = new SummaryService(llmClient);

    const session = new MultiPersonaChatSession({
      llmClient,
      storageClient,
      titleService,
      summaryService,
      personas: [
        {
          id: 'concise-responder',
          name: 'Concise Responder',
          systemPrompt: 'You are extremely concise. Answer in one sentence maximum.',
        },
      ],
      orchestrator: sequentialOrchestrator,
    });

    session.createNewConversation();

    // Send a message that should get a short response
    await session.sendMessage('What is 2+2?');

    const conv = session.getConversation();
    expect(conv).not.toBeNull();

    const assistantMessage = conv!.messages[1];
    console.log('Short response length:', assistantMessage.content.length);
    console.log('Short response:', assistantMessage.content);

    // Short response should NOT have a summary
    expect(assistantMessage.content.length).toBeLessThan(SUMMARY_THRESHOLD);
    expect(assistantMessage.summary).toBeUndefined();
  }, 60000);

  it('should work without summaryService (backwards compatibility)', async () => {
    const serverUrl = getServerUrl();
    const llmClient = new APILLMClient({
      chatEndpoint: `${serverUrl}/api/chat`,
      completeEndpoint: `${serverUrl}/api/complete`,
    });
    const storageClient = new APIStorageClient(`${serverUrl}/api/storage/conversations`);
    const titleService = new TitleService(llmClient);

    // Create session WITHOUT summaryService
    const session = new MultiPersonaChatSession({
      llmClient,
      storageClient,
      titleService,
      // summaryService intentionally omitted
      personas: [
        {
          id: 'test-persona',
          name: 'Test Persona',
          systemPrompt: 'You are a helpful assistant.',
        },
      ],
      orchestrator: sequentialOrchestrator,
    });

    session.createNewConversation();
    await session.sendMessage('Hello!');

    const conv = session.getConversation();
    expect(conv).not.toBeNull();
    expect(conv!.messages.length).toBe(2);

    // Should work fine, just no summary
    expect(conv!.messages[1].summary).toBeUndefined();
  }, 60000);
});
