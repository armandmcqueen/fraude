import { Conversation, ConversationSummary } from '@/types';

/**
 * Interface for conversation persistence.
 */
export interface StorageClient {
  /**
   * Get list of all conversations (summary only, no messages).
   */
  listConversations(): Promise<ConversationSummary[]>;

  /**
   * Get a single conversation by ID, including all messages.
   */
  getConversation(id: string): Promise<Conversation | null>;

  /**
   * Save a conversation (create or update).
   */
  saveConversation(conversation: Conversation): Promise<void>;
}
