import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, getServerUrl, waitForServer } from './server-utils';
import { MultiPersonaChatSession } from '@/services/MultiActorChatSession';
import { TitleService } from '@/services/TitleService';
import { APILLMClient } from '@/services/llm/APILLMClient';
import { APIStorageClient } from '@/services/storage/APIStorageClient';
import { sequentialOrchestrator, ConversationConfig } from '@/services/orchestration';
import { PERSONAS } from '@/lib/personas';

describe('Multi-Persona Chat Tests', () => {
  let llmClient: APILLMClient;
  let storageClient: APIStorageClient;
  let titleService: TitleService;

  beforeAll(async () => {
    await startServer();
    await waitForServer();

    const serverUrl = getServerUrl();
    llmClient = new APILLMClient({
      chatEndpoint: `${serverUrl}/api/chat`,
      completeEndpoint: `${serverUrl}/api/complete`,
    });
    storageClient = new APIStorageClient(`${serverUrl}/api/storage/conversations`);
    titleService = new TitleService(llmClient);
  }, 120000);

  afterAll(async () => {
    await stopServer();
  });

  it('should get responses from multiple personas sequentially', async () => {
    const session = new MultiPersonaChatSession({
      llmClient,
      storageClient,
      titleService,
      personas: PERSONAS,
      orchestrator: sequentialOrchestrator,
    });

    // Track events
    const events: string[] = [];
    const messageUpdates: { messageId: string; content: string }[] = [];

    session.events.on('conversationUpdated', (conv) => {
      events.push(`conversationUpdated: ${conv.messages.length} messages`);
    });
    session.events.on('streamStart', ({ messageId }) => {
      events.push(`streamStart: ${messageId}`);
    });
    session.events.on('streamChunk', ({ messageId, fullContent }) => {
      messageUpdates.push({ messageId, content: fullContent });
    });
    session.events.on('streamEnd', ({ messageId }) => {
      events.push(`streamEnd: ${messageId}`);
    });
    session.events.on('error', (err) => {
      events.push(`error: ${err.message}`);
    });

    // Create conversation
    session.createNewConversation();
    const conv = session.getConversation();
    expect(conv).toBeDefined();
    console.log('Created conversation:', conv!.id);

    // Send message
    console.log('Sending message...');
    await session.sendMessage('Should I learn Python or JavaScript first?');

    // Log events for debugging
    console.log('Events:', events);

    // Check for errors
    const errorEvents = events.filter((e) => e.startsWith('error:'));
    expect(errorEvents).toHaveLength(0);

    // Verify conversation state
    const finalConv = session.getConversation();
    console.log('Final message count:', finalConv!.messages.length);

    // Should have: 1 user message + 2 persona messages = 3 messages
    expect(finalConv!.messages).toHaveLength(3);

    // Check user message
    const userMsg = finalConv!.messages[0];
    expect(userMsg.role).toBe('user');
    expect(userMsg.personaId).toBeUndefined();

    // Check first persona (Optimist)
    const optimistMsg = finalConv!.messages[1];
    expect(optimistMsg.role).toBe('assistant');
    expect(optimistMsg.personaId).toBe('optimist');
    expect(optimistMsg.content.length).toBeGreaterThan(0);
    console.log('Optimist response:', optimistMsg.content.substring(0, 100) + '...');

    // Check second persona (Critic)
    const criticMsg = finalConv!.messages[2];
    expect(criticMsg.role).toBe('assistant');
    expect(criticMsg.personaId).toBe('critic');
    expect(criticMsg.content.length).toBeGreaterThan(0);
    console.log('Critic response:', criticMsg.content.substring(0, 100) + '...');

    // Verify both personas got stream chunks
    const optimistChunks = messageUpdates.filter((u) => u.messageId === optimistMsg.id);
    const criticChunks = messageUpdates.filter((u) => u.messageId === criticMsg.id);
    console.log('Optimist chunks:', optimistChunks.length);
    console.log('Critic chunks:', criticChunks.length);
    expect(optimistChunks.length).toBeGreaterThan(0);
    expect(criticChunks.length).toBeGreaterThan(0);

    console.log('Multi-persona test completed successfully!');
  }, 90000);

  it('should get responses from personas in parallel with isolated context', async () => {
    const parallelConfig: ConversationConfig = {
      executionMode: 'parallel',
      contextMode: 'isolated',
    };

    const session = new MultiPersonaChatSession({
      llmClient,
      storageClient,
      titleService,
      personas: PERSONAS,
      orchestrator: sequentialOrchestrator,
      config: parallelConfig,
    });

    // Track timing to verify parallel execution
    const startTime = Date.now();
    const chunkTimestamps: { personaId: string; time: number }[] = [];

    session.events.on('streamChunk', ({ messageId }) => {
      const conv = session.getConversation();
      const msg = conv?.messages.find((m) => m.id === messageId);
      if (msg?.personaId) {
        chunkTimestamps.push({ personaId: msg.personaId, time: Date.now() - startTime });
      }
    });

    // Create conversation
    session.createNewConversation();
    console.log('Created conversation:', session.getConversation()!.id);

    // Send message
    console.log('Sending message (parallel mode)...');
    await session.sendMessage('What is the best programming language?');

    // Verify conversation state
    const finalConv = session.getConversation();
    console.log('Final message count:', finalConv!.messages.length);

    // Should have: 1 user message + 2 persona messages = 3 messages
    expect(finalConv!.messages).toHaveLength(3);

    // Check both personas responded
    const optimistMsg = finalConv!.messages[1];
    const criticMsg = finalConv!.messages[2];
    expect(optimistMsg.personaId).toBe('optimist');
    expect(criticMsg.personaId).toBe('critic');
    expect(optimistMsg.content.length).toBeGreaterThan(0);
    expect(criticMsg.content.length).toBeGreaterThan(0);

    console.log('Optimist response:', optimistMsg.content.substring(0, 80) + '...');
    console.log('Critic response:', criticMsg.content.substring(0, 80) + '...');

    // Verify interleaved chunks (indicates parallel execution)
    // In parallel mode, we should see chunks from both personas arriving during overlapping time windows
    const optimistChunks = chunkTimestamps.filter((c) => c.personaId === 'optimist');
    const criticChunks = chunkTimestamps.filter((c) => c.personaId === 'critic');

    console.log('Optimist first chunk at:', optimistChunks[0]?.time, 'ms');
    console.log('Critic first chunk at:', criticChunks[0]?.time, 'ms');
    console.log('Optimist last chunk at:', optimistChunks[optimistChunks.length - 1]?.time, 'ms');
    console.log('Critic last chunk at:', criticChunks[criticChunks.length - 1]?.time, 'ms');

    // Both should have started receiving chunks (basic sanity check)
    expect(optimistChunks.length).toBeGreaterThan(0);
    expect(criticChunks.length).toBeGreaterThan(0);

    // In parallel mode, both personas should start within a short window of each other
    // (much less than the full response time of either)
    const firstOptimist = optimistChunks[0]?.time ?? Infinity;
    const firstCritic = criticChunks[0]?.time ?? Infinity;
    const startDelta = Math.abs(firstOptimist - firstCritic);
    console.log('Time between first chunks:', startDelta, 'ms');

    // Both should start within 2 seconds of each other if truly parallel
    // (sequential would have ~5-10s gap)
    expect(startDelta).toBeLessThan(2000);

    console.log('Parallel execution test completed successfully!');
  }, 90000);
});
