import { Conversation, Message } from '@/types';
import { APILLMClient } from './llm';
import { StorageClient } from './storage/types';
import { TitleService } from './TitleService';
import { EventEmitter, ChatSessionEvents } from './types';
import { OrchestrationPersona, Orchestrator, ConversationConfig, DEFAULT_CONFIG } from './orchestration';
import { generateId } from '@/lib/utils';
import { config } from '@/lib/config';

export interface MultiPersonaChatSessionDeps {
  llmClient: APILLMClient;
  storageClient: StorageClient;
  titleService: TitleService;
  personas: OrchestrationPersona[];
  orchestrator: Orchestrator;
  config?: ConversationConfig;
}

/**
 * Multi-persona chat session that orchestrates responses from multiple AI personas.
 * Implements the same interface as ChatSession so useChat hook works unchanged.
 */
export class MultiPersonaChatSession {
  readonly events = new EventEmitter<ChatSessionEvents>();

  private conversation: Conversation | null = null;
  private llmClient: APILLMClient;
  private storageClient: StorageClient;
  private titleService: TitleService;
  private personas: OrchestrationPersona[];
  private personaNameMap: Map<string, string> = new Map();
  private orchestrator: Orchestrator;
  private conversationConfig: ConversationConfig;
  private isStreaming = false;
  private abortController: AbortController | null = null;
  private currentMessageId: string | null = null;

  constructor(deps: MultiPersonaChatSessionDeps) {
    this.llmClient = deps.llmClient;
    this.storageClient = deps.storageClient;
    this.titleService = deps.titleService;
    this.personas = deps.personas;
    this.orchestrator = deps.orchestrator;
    this.conversationConfig = deps.config ?? DEFAULT_CONFIG;
    this.updatePersonaNameMap();
  }

  /**
   * Update the internal persona name lookup map.
   */
  private updatePersonaNameMap(): void {
    this.personaNameMap.clear();
    for (const persona of this.personas) {
      this.personaNameMap.set(persona.id, persona.name);
    }
  }

  /**
   * Get the display name for a persona ID.
   */
  getPersonaName(personaId: string): string {
    return this.personaNameMap.get(personaId) ?? personaId;
  }

  /**
   * Update the list of personas.
   */
  setPersonas(personas: OrchestrationPersona[]): void {
    this.personas = [...personas];
    this.updatePersonaNameMap();
  }

  getConversation(): Conversation | null {
    return this.conversation;
  }

  getIsStreaming(): boolean {
    return this.isStreaming;
  }

  getConfig(): ConversationConfig {
    return { ...this.conversationConfig };
  }

  setConfig(newConfig: ConversationConfig): void {
    this.conversationConfig = { ...newConfig };
  }

  async loadConversation(id: string): Promise<void> {
    const conversation = await this.storageClient.getConversation(id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }
    this.conversation = conversation;
    this.events.emit('conversationUpdated', this.conversation);
  }

  createNewConversation(model?: string): void {
    const now = new Date();
    this.conversation = {
      id: generateId(),
      title: 'New conversation',
      messages: [],
      model: model || config.defaultModel,
      createdAt: now,
      updatedAt: now,
    };
    this.events.emit('conversationUpdated', this.conversation);
  }

  setModel(model: string): void {
    if (!this.conversation) return;
    this.conversation = { ...this.conversation, model };
    this.events.emit('conversationUpdated', this.conversation);
  }

  /**
   * Cancel the current streaming operation.
   */
  cancel(): void {
    if (this.abortController && this.isStreaming) {
      this.abortController.abort();
      this.abortController = null;
      this.isStreaming = false;
      if (this.currentMessageId) {
        this.events.emit('streamCancelled', { messageId: this.currentMessageId });
      }
      this.events.emit('streamEnd', { messageId: this.currentMessageId || '' });
    }
  }

  /**
   * Send a message and orchestrate responses from multiple personas.
   */
  async sendMessage(content: string): Promise<void> {
    if (!this.conversation || this.isStreaming) return;

    const isNewConversation = this.conversation.messages.length === 0;

    // Create user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      createdAt: new Date(),
    };

    // Add user message to conversation
    this.conversation = {
      ...this.conversation,
      messages: [...this.conversation.messages, userMessage],
      updatedAt: new Date(),
    };
    this.events.emit('conversationUpdated', this.conversation);

    // Set up abort controller for cancellation
    this.abortController = new AbortController();
    this.currentMessageId = userMessage.id;
    this.isStreaming = true;
    this.events.emit('streamStart', { messageId: userMessage.id });

    try {
      // Get the response plan from orchestrator
      const responsePlan = this.orchestrator.getResponsePlan({
        personas: this.personas,
        conversation: this.conversation,
        userMessage,
      });

      // Execute based on configuration
      if (this.conversationConfig.executionMode === 'parallel') {
        await this.executeParallel(responsePlan);
      } else {
        await this.executeSequential(responsePlan);
      }

      // Generate title if this is the first message exchange
      if (isNewConversation && this.conversation.messages.length > 1) {
        const title = await this.titleService.generate(
          this.conversation.id,
          content
        );
        this.conversation = { ...this.conversation, title };
        this.events.emit('conversationUpdated', this.conversation);
      }

      // Save to storage
      await this.storageClient.saveConversation(this.conversation);
    } catch (error) {
      // Don't emit error if it was an abort
      if (error instanceof Error && error.name === 'AbortError') {
        // Cancellation already handled in cancel()
        return;
      }
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.events.emit('error', err);
    } finally {
      this.abortController = null;
      this.currentMessageId = null;
      this.isStreaming = false;
      this.events.emit('streamEnd', { messageId: userMessage.id });
    }
  }

  /**
   * Execute personas sequentially, one at a time.
   */
  private async executeSequential(personas: OrchestrationPersona[]): Promise<void> {
    for (const persona of personas) {
      await this.streamPersonaResponse(persona);
    }
  }

  /**
   * Execute personas in parallel, all at once.
   * Note: parallel mode always uses isolated context.
   */
  private async executeParallel(personas: OrchestrationPersona[]): Promise<void> {
    if (!this.conversation) return;

    // Capture the conversation state before any responses
    // (for isolated context, each persona sees only this)
    const historySnapshot = this.formatConversationForLLM(true);

    // Create placeholder messages for all personas upfront
    const personaMessages: Map<string, Message> = new Map();
    for (const persona of personas) {
      const msg: Message = {
        id: generateId(),
        role: 'assistant',
        content: '',
        createdAt: new Date(),
        personaId: persona.id,
      };
      personaMessages.set(persona.id, msg);
      this.conversation = {
        ...this.conversation,
        messages: [...this.conversation.messages, msg],
        updatedAt: new Date(),
      };
    }
    this.events.emit('conversationUpdated', this.conversation);

    // Start all streams in parallel
    const streamPromises = personas.map((persona) =>
      this.streamPersonaResponseParallel(
        persona,
        personaMessages.get(persona.id)!,
        historySnapshot
      )
    );

    // Wait for all to complete
    await Promise.all(streamPromises);
  }

  /**
   * Stream a response from a single persona (sequential mode).
   */
  private async streamPersonaResponse(persona: OrchestrationPersona): Promise<void> {
    if (!this.conversation) return;

    // Create placeholder message for this persona
    const personaMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      createdAt: new Date(),
      personaId: persona.id,
    };

    // Add to conversation
    this.conversation = {
      ...this.conversation,
      messages: [...this.conversation.messages, personaMessage],
      updatedAt: new Date(),
    };
    this.events.emit('conversationUpdated', this.conversation);

    // Format conversation history for LLM
    const useIsolated = this.conversationConfig.contextMode === 'isolated';
    const formattedHistory = this.formatConversationForLLM(useIsolated);
    const systemPrompt = this.buildSystemPrompt(persona, useIsolated);

    const messagesForLLM: Message[] = [
      {
        id: 'history',
        role: 'user',
        content: formattedHistory,
        createdAt: new Date(),
      },
    ];

    let personaContent = '';

    for await (const chunk of this.llmClient.streamChat(
      this.conversation.id,
      messagesForLLM,
      systemPrompt,
      { model: this.conversation.model },
      this.abortController?.signal
    )) {
      if (chunk.type === 'text' && chunk.content) {
        personaContent += chunk.content;
        this.updateMessage(personaMessage.id, personaContent);
        this.events.emit('streamChunk', {
          messageId: personaMessage.id,
          content: chunk.content,
          fullContent: personaContent,
        });
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'Stream error');
      }
    }
  }

  /**
   * Stream a response from a single persona (parallel mode).
   * Uses pre-created message and pre-captured history.
   */
  private async streamPersonaResponseParallel(
    persona: OrchestrationPersona,
    personaMessage: Message,
    historySnapshot: string
  ): Promise<void> {
    if (!this.conversation) return;

    const systemPrompt = this.buildSystemPrompt(persona, true); // parallel always isolated

    const messagesForLLM: Message[] = [
      {
        id: 'history',
        role: 'user',
        content: historySnapshot,
        createdAt: new Date(),
      },
    ];

    let personaContent = '';

    for await (const chunk of this.llmClient.streamChat(
      this.conversation.id,
      messagesForLLM,
      systemPrompt,
      { model: this.conversation.model },
      this.abortController?.signal
    )) {
      if (chunk.type === 'text' && chunk.content) {
        personaContent += chunk.content;
        this.updateMessage(personaMessage.id, personaContent);
        this.events.emit('streamChunk', {
          messageId: personaMessage.id,
          content: chunk.content,
          fullContent: personaContent,
        });
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'Stream error');
      }
    }
  }

  /**
   * Format conversation history with labels for each speaker.
   * @param isolatedContext If true, only include user messages (not other personas)
   */
  private formatConversationForLLM(isolatedContext: boolean = false): string {
    if (!this.conversation) return '';

    const lines: string[] = [];
    for (const msg of this.conversation.messages) {
      // Skip empty placeholder messages
      if (msg.role === 'assistant' && !msg.content) continue;

      if (msg.role === 'user') {
        lines.push(`[User]: ${msg.content}`);
      } else if (msg.personaId && !isolatedContext) {
        // Only include other personas' messages if not isolated
        const name = this.getPersonaName(msg.personaId);
        lines.push(`[${name}]: ${msg.content}`);
      }
    }
    return lines.join('\n\n');
  }

  /**
   * Build system prompt that includes persona instructions and format explanation.
   */
  private buildSystemPrompt(persona: OrchestrationPersona, isolated: boolean): string {
    if (isolated) {
      return `You are the "${persona.name}" persona.

${persona.systemPrompt}

Respond to the user's message directly. Do not include any label prefix in your response.`;
    }

    return `You are participating in a multi-persona conversation. You are the "${persona.name}" persona.

${persona.systemPrompt}

The conversation history shows messages labeled with [User] for the human and [PersonaName] for each AI persona.

Respond as the ${persona.name} persona. Do not include any label prefix in your response - just provide your response directly.`;
  }

  /**
   * Update the content of a message by ID.
   */
  private updateMessage(messageId: string, content: string): void {
    if (!this.conversation) return;

    const messages = this.conversation.messages.map((msg) =>
      msg.id === messageId ? { ...msg, content } : msg
    );

    this.conversation = {
      ...this.conversation,
      messages,
      updatedAt: new Date(),
    };

    this.events.emit('conversationUpdated', this.conversation);
  }
}

// Also export with old name for compatibility during transition
export { MultiPersonaChatSession as MultiActorChatSession };
export type { MultiPersonaChatSessionDeps as MultiActorChatSessionDeps };
