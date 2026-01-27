import { Conversation, ConversationSummary, Persona, PersonaSummary, Resource, ResourceSummary, UserSettings } from '@/types';

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

/**
 * Interface for resource persistence.
 */
export interface ResourceStorageClient {
  /**
   * Get list of all resources (summary only, no content).
   */
  listResources(): Promise<ResourceSummary[]>;

  /**
   * Get a single resource by ID, including full content.
   */
  getResource(id: string): Promise<Resource | null>;

  /**
   * Create a new resource.
   */
  createResource(resource: Resource): Promise<void>;

  /**
   * Update an existing resource.
   */
  updateResource(resource: Resource): Promise<void>;

  /**
   * Delete a resource by ID.
   */
  deleteResource(id: string): Promise<void>;
}

/**
 * Interface for user settings persistence.
 */
export interface SettingsStorageClient {
  /**
   * Get user settings.
   */
  getSettings(): Promise<UserSettings>;

  /**
   * Save user settings.
   */
  saveSettings(settings: UserSettings): Promise<void>;
}
