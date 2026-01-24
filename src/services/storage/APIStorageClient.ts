import { Conversation, ConversationSummary } from '@/types';
import { StorageClient } from './types';

/**
 * Storage client that uses the Next.js API routes.
 */
export class APIStorageClient implements StorageClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/storage/conversations') {
    this.baseUrl = baseUrl;
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const response = await fetch(this.baseUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch conversations');
    }

    const data = await response.json();
    return data.map((c: ConversationSummary) => ({
      ...c,
      updatedAt: new Date(c.updatedAt),
    }));
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch conversation');
    }

    const data = await response.json();
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      messages: data.messages.map((m: { createdAt: string | Date }) => ({
        ...m,
        createdAt: new Date(m.createdAt),
      })),
    };
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    // Check if conversation exists to determine create vs update
    const existing = await this.getConversation(conversation.id);
    const isNew = !existing;

    const endpoint = isNew ? this.baseUrl : `${this.baseUrl}/${conversation.id}`;
    const method = isNew ? 'POST' : 'PUT';

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conversation),
    });

    if (!response.ok) {
      throw new Error('Failed to save conversation');
    }
  }
}
