import { Conversation, ConversationSummary, Persona, PersonaSummary } from '@/types';

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

/**
 * Interface for persona persistence.
 */
export interface PersonaStorageClient {
  /**
   * Get list of all personas (summary only, no system prompts).
   */
  listPersonas(): Promise<PersonaSummary[]>;

  /**
   * Get a single persona by ID, including full data.
   */
  getPersona(id: string): Promise<Persona | null>;

  /**
   * Create a new persona.
   */
  createPersona(persona: Persona): Promise<void>;

  /**
   * Delete a persona by ID.
   */
  deletePersona(id: string): Promise<void>;
}
