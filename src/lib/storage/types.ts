import { Conversation, ConversationSummary, Persona, PersonaSummary } from '@/types';

export interface StorageProvider {
  listConversations(): Promise<ConversationSummary[]>;
  getConversation(id: string): Promise<Conversation | null>;
  createConversation(conversation: Conversation): Promise<void>;
  updateConversation(conversation: Conversation): Promise<void>;
}

export interface PersonaStorageProvider {
  listPersonas(): Promise<PersonaSummary[]>;
  getPersona(id: string): Promise<Persona | null>;
  createPersona(persona: Persona): Promise<void>;
  deletePersona(id: string): Promise<void>;
  ensureDefaultPersonas(): Promise<void>;
}
