import { Conversation, Message } from '@/types';
import { APILLMClient } from './llm';
import { StorageClient } from './storage/types';
import { PromptProvider } from './prompt/types';
import { TitleService } from './TitleService';
import { EventEmitter, ChatSessionEvents } from './types';
import { generateId } from '@/lib/utils';
import { config } from '@/lib/config';

export interface ChatSessionDeps {
  llmClient: APILLMClient;
  storageClient: StorageClient;
  promptProvider: PromptProvider;
  titleService: TitleService;
}

/**
 * Core business logic for managing a chat conversation.
 * Runs client-side. Coordinates LLM (via API) and storage, emits events for UI.
 */
export class ChatSession {
  readonly events = new EventEmitter<ChatSessionEvents>();

  private conversation: Conversation | null = null;
  private llmClient: APILLMClient;
  private storageClient: StorageClient;
  private promptProvider: PromptProvider;
  private titleService: TitleService;
  private isStreaming = false;
  private abortController: AbortController | null = null;
  private currentMessageId: string | null = null;

  constructor(deps: ChatSessionDeps) {
    this.llmClient = deps.llmClient;
    this.storageClient = deps.storageClient;
    this.promptProvider = deps.promptProvider;
    this.titleService = deps.titleService;
  }

  /**
   * Get the current conversation state.
   */
  getConversation(): Conversation | null {
    return this.conversation;
  }

  /**
   * Check if currently streaming a response.
   */
  getIsStreaming(): boolean {
    return this.isStreaming;
  }

  /**
   * Load an existing conversation by ID.
   */
  async loadConversation(id: string): Promise<void> {
    const conversation = await this.storageClient.getConversation(id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }
    this.conversation = conversation;
    this.events.emit('conversationUpdated', this.conversation);
  }

  /**
   * Create a new conversation in memory (not persisted until first message).
   */
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

  /**
   * Set the model for the current conversation.
   */
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
   * Send a message and stream the assistant's response.
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

    // Create placeholder assistant message
    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      createdAt: new Date(),
    };

    // Update state with both messages
    this.conversation = {
      ...this.conversation,
      messages: [...this.conversation.messages, userMessage, assistantMessage],
      updatedAt: new Date(),
    };
    this.events.emit('conversationUpdated', this.conversation);

    // Set up abort controller for cancellation
    this.abortController = new AbortController();
    this.currentMessageId = assistantMessage.id;
    this.isStreaming = true;
    this.events.emit('streamStart', { messageId: assistantMessage.id });

    try {
      // Get system prompt
      const systemPrompt = await this.promptProvider.getSystemPrompt({
        conversationId: this.conversation.id,
        model: this.conversation.model,
      });

      // Stream the response
      const messagesForLLM = [...this.conversation.messages.slice(0, -1)]; // Exclude empty assistant message
      let assistantContent = '';

      for await (const chunk of this.llmClient.streamChat(
        this.conversation.id,
        messagesForLLM,
        systemPrompt,
        { model: this.conversation.model },
        this.abortController?.signal
      )) {
        if (chunk.type === 'text' && chunk.content) {
          assistantContent += chunk.content;

          // Update assistant message content
          this.updateAssistantMessage(assistantMessage.id, assistantContent);

          this.events.emit('streamChunk', {
            messageId: assistantMessage.id,
            content: chunk.content,
            fullContent: assistantContent,
          });
        } else if (chunk.type === 'error') {
          throw new Error(chunk.error || 'Stream error');
        }
      }

      // Generate title if this is the first message
      if (isNewConversation && assistantContent) {
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

      // Update assistant message with error
      this.updateAssistantMessage(
        assistantMessage.id,
        `Error: ${err.message}`
      );
    } finally {
      this.abortController = null;
      this.currentMessageId = null;
      this.isStreaming = false;
      this.events.emit('streamEnd', { messageId: assistantMessage.id });
    }
  }

  /**
   * Update the content of the assistant message.
   */
  private updateAssistantMessage(messageId: string, content: string): void {
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
