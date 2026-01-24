import { Conversation, ConversationSummary } from '@/types';
import { StorageClient } from './types';

/**
 * In-memory storage client for testing.
 * Does not persist data between instances.
 */
export class InMemoryStorageClient implements StorageClient {
  private conversations: Map<string, Conversation> = new Map();

  async listConversations(): Promise<ConversationSummary[]> {
    const summaries: ConversationSummary[] = [];

    for (const conv of this.conversations.values()) {
      summaries.push({
        id: conv.id,
        title: conv.title,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages.length,
      });
    }

    // Sort by updatedAt descending
    return summaries.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) || null;
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    // Deep clone to avoid mutation issues
    this.conversations.set(conversation.id, JSON.parse(JSON.stringify(conversation)));
  }

  /**
   * Clear all stored conversations.
   */
  clear(): void {
    this.conversations.clear();
  }

  /**
   * Get count of stored conversations.
   */
  count(): number {
    return this.conversations.size;
  }
}
