import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, getServerUrl, waitForServer } from './server-utils';
import { ChatSession } from '@/services/ChatSession';
import { TitleService } from '@/services/TitleService';
import { APILLMClient } from '@/services/llm/APILLMClient';
import { APIStorageClient } from '@/services/storage/APIStorageClient';
import { DefaultPromptProvider } from '@/services/prompt/DefaultPromptProvider';

describe('Live LLM Tests', () => {
  let llmClient: APILLMClient;
  let storageClient: APIStorageClient;
  let promptProvider: DefaultPromptProvider;
  let titleService: TitleService;

  beforeAll(async () => {
    await startServer();
    await waitForServer();

    // Create clients pointed at the test server
    const serverUrl = getServerUrl();
    llmClient = new APILLMClient({
      chatEndpoint: `${serverUrl}/api/chat`,
      completeEndpoint: `${serverUrl}/api/complete`,
    });
    storageClient = new APIStorageClient(`${serverUrl}/api/storage/conversations`);
    promptProvider = new DefaultPromptProvider();
    titleService = new TitleService(llmClient);
  }, 120000);

  afterAll(async () => {
    await stopServer();
  });

  it('should stream a response using APILLMClient', async () => {
    const conversationId = `test-${Date.now()}`;
    const systemPrompt = 'You are a helpful assistant. Answer concisely.';
    const messages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'What is the capital of France?',
        createdAt: new Date(),
      },
    ];

    let fullResponse = '';
    for await (const chunk of llmClient.streamChat(
      conversationId,
      messages,
      systemPrompt,
      { model: 'claude-sonnet-4-5-20250929' }
    )) {
      if (chunk.type === 'text' && chunk.content) {
        fullResponse += chunk.content;
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error);
      }
    }

    console.log('Response:', fullResponse);
    expect(fullResponse.toLowerCase()).toContain('paris');
  }, 30000);

  it('should generate a title using TitleService', async () => {
    const conversationId = `test-${Date.now()}`;
    const userMessage = 'How do I make a chocolate cake?';

    const title = await titleService.generate(conversationId, userMessage);

    console.log('Generated title:', title);
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(50);
    // Title should relate to the topic
    expect(title.toLowerCase()).toMatch(/cake|chocolate|baking|recipe/);
  }, 30000);

  it('should complete full conversation flow using ChatSession', async () => {
    // Create a ChatSession with real services
    const session = new ChatSession({
      llmClient,
      storageClient,
      promptProvider,
      titleService,
    });

    // Track events
    const events: string[] = [];
    let finalTitle = '';

    session.events.on('conversationUpdated', (conv) => {
      events.push('conversationUpdated');
      finalTitle = conv.title;
    });
    session.events.on('streamStart', () => events.push('streamStart'));
    session.events.on('streamEnd', () => events.push('streamEnd'));
    session.events.on('error', (err) => {
      events.push(`error: ${err.message}`);
    });

    // Step 1: Create a new conversation
    session.createNewConversation();
    const conv = session.getConversation();
    expect(conv).toBeDefined();
    expect(conv!.title).toBe('New conversation');
    expect(conv!.messages).toHaveLength(0);
    console.log('Created conversation:', conv!.id);

    // Step 2: Send a message
    console.log('Sending message...');
    await session.sendMessage('What are the planets in our solar system?');

    // Verify we got events in the right order
    expect(events).toContain('streamStart');
    expect(events).toContain('streamEnd');
    expect(events.filter((e) => e === 'conversationUpdated').length).toBeGreaterThan(2);

    // Verify conversation state
    const updatedConv = session.getConversation();
    expect(updatedConv!.messages).toHaveLength(2);
    expect(updatedConv!.messages[0].role).toBe('user');
    expect(updatedConv!.messages[1].role).toBe('assistant');

    // Verify response content
    const response = updatedConv!.messages[1].content;
    console.log('Response:', response);
    expect(response.toLowerCase()).toMatch(/mercury|venus|earth|mars|jupiter|saturn/);

    // Verify title was generated
    console.log('Generated title:', finalTitle);
    expect(finalTitle).not.toBe('New conversation');
    expect(finalTitle.length).toBeLessThanOrEqual(50);

    // Step 3: Verify conversation was saved to storage
    console.log('Verifying storage...');
    const loaded = await storageClient.getConversation(updatedConv!.id);
    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe(updatedConv!.id);
    expect(loaded!.title).toBe(finalTitle);
    expect(loaded!.messages).toHaveLength(2);

    // Step 4: Verify it appears in conversation list
    const conversations = await storageClient.listConversations();
    const found = conversations.find((c) => c.id === updatedConv!.id);
    expect(found).toBeDefined();
    expect(found!.messageCount).toBe(2);

    console.log('Full conversation flow completed successfully!');
  }, 60000);

  it('should handle multi-turn conversation', async () => {
    const session = new ChatSession({
      llmClient,
      storageClient,
      promptProvider,
      titleService,
    });

    session.createNewConversation();

    // First message
    console.log('Turn 1: Asking about a topic...');
    await session.sendMessage('What is photosynthesis?');

    let conv = session.getConversation();
    expect(conv!.messages).toHaveLength(2);
    const firstResponse = conv!.messages[1].content;
    console.log('First response:', firstResponse.substring(0, 100) + '...');

    // Second message - follow up
    console.log('Turn 2: Asking follow-up...');
    await session.sendMessage('What gas does it produce?');

    conv = session.getConversation();
    expect(conv!.messages).toHaveLength(4);
    const secondResponse = conv!.messages[3].content;
    console.log('Second response:', secondResponse);

    // The response should mention oxygen since we asked about photosynthesis products
    expect(secondResponse.toLowerCase()).toContain('oxygen');

    // Verify all messages are saved
    const loaded = await storageClient.getConversation(conv!.id);
    expect(loaded!.messages).toHaveLength(4);

    console.log('Multi-turn conversation completed successfully!');
  }, 90000);
});
