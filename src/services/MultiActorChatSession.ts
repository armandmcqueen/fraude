import { Conversation, Message } from '@/types';
import { APILLMClient } from './llm';
import { StorageClient } from './storage/types';
import { TitleService } from './TitleService';
import { EventEmitter, ChatSessionEvents } from './types';
import { Persona, Orchestrator } from './orchestration';
import { generateId } from '@/lib/utils';
import { config } from '@/lib/config';
import { getPersonaName } from '@/lib/personas';

export interface MultiPersonaChatSessionDeps {
  llmClient: APILLMClient;
  storageClient: StorageClient;
  titleService: TitleService;
  personas: Persona[];
  orchestrator: Orchestrator;
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
  private personas: Persona[];
  private orchestrator: Orchestrator;
  private isStreaming = false;

  constructor(deps: MultiPersonaChatSessionDeps) {
    this.llmClient = deps.llmClient;
    this.storageClient = deps.storageClient;
    this.titleService = deps.titleService;
    this.personas = deps.personas;
    this.orchestrator = deps.orchestrator;
  }

  getConversation(): Conversation | null {
    return this.conversation;
  }

  getIsStreaming(): boolean {
    return this.isStreaming;
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

    this.isStreaming = true;
    this.events.emit('streamStart', { messageId: userMessage.id });

    try {
      // Get the response plan from orchestrator
      const responsePlan = this.orchestrator.getResponsePlan({
        personas: this.personas,
        conversation: this.conversation,
        userMessage,
      });

      // Process each persona in the plan sequentially
      for (const persona of responsePlan) {
        await this.streamPersonaResponse(persona);
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
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.events.emit('error', err);
    } finally {
      this.isStreaming = false;
      this.events.emit('streamEnd', { messageId: userMessage.id });
    }
  }

  /**
   * Stream a response from a single persona.
   */
  private async streamPersonaResponse(persona: Persona): Promise<void> {
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
    // We send the history as a single user message with labels showing who said what
    const formattedHistory = this.formatConversationForLLM();
    const systemPrompt = this.buildSystemPrompt(persona);

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
      { model: this.conversation.model }
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
   * Excludes empty placeholder messages.
   */
  private formatConversationForLLM(): string {
    if (!this.conversation) return '';

    const lines: string[] = [];
    for (const msg of this.conversation.messages) {
      // Skip empty placeholder messages
      if (msg.role === 'assistant' && !msg.content) continue;

      if (msg.role === 'user') {
        lines.push(`[User]: ${msg.content}`);
      } else if (msg.personaId) {
        const name = getPersonaName(msg.personaId);
        lines.push(`[${name}]: ${msg.content}`);
      }
    }
    return lines.join('\n\n');
  }

  /**
   * Build system prompt that includes persona instructions and format explanation.
   */
  private buildSystemPrompt(persona: Persona): string {
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
