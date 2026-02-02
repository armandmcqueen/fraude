import { Conversation } from '@/types';

/**
 * Common interface for chat sessions (both single and multi-actor).
 * Allows components to work with either implementation.
 */
export interface ChatSessionInterface {
  readonly events: EventEmitter<ChatSessionEvents>;
  getConversation(): Conversation | null;
  getIsStreaming(): boolean;
  loadConversation(id: string): Promise<void>;
  createNewConversation(model?: string): void;
  setModel(model: string): void;
  sendMessage(content: string): Promise<void>;
  cancel(): void;
}

/**
 * Events emitted by ChatSession for UI to subscribe to.
 */
export interface ChatSessionEvents {
  /** Fired when conversation state changes (new message, title update, etc.) */
  conversationUpdated: Conversation;

  /** Fired for each streaming chunk during assistant response */
  streamChunk: { messageId: string; content: string; fullContent: string };

  /** Fired when streaming starts */
  streamStart: { messageId: string };

  /** Fired when streaming completes */
  streamEnd: { messageId: string };

  /** Fired when streaming is cancelled by user */
  streamCancelled: { messageId: string };

  /** Fired when summary generation starts for a message */
  summaryStart: { messageId: string };

  /** Fired when summary generation completes for a message */
  summaryEnd: { messageId: string };

  /** Fired on errors */
  error: Error;
}

/**
 * Simple typed event emitter for services.
 */
export class EventEmitter<T extends { [K in keyof T]: unknown }> {
  private listeners: { [K in keyof T]?: Array<(data: T[K]) => void> } = {};

  on<K extends keyof T>(event: K, listener: (data: T[K]) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);

    // Return unsubscribe function
    return () => {
      const arr = this.listeners[event];
      if (arr) {
        const idx = arr.indexOf(listener);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    const arr = this.listeners[event];
    if (arr) {
      arr.forEach((listener) => listener(data));
    }
  }

  removeAllListeners(): void {
    this.listeners = {};
  }
}
