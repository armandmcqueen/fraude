import { Conversation } from '@/types';

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
