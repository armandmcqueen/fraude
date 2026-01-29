import { Conversation, ConversationSummary, Persona, PersonaSummary, Resource, ResourceSummary, TestInput, TestInputSummary, UserSettings } from '@/types';

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
  updatePersona(persona: Persona): Promise<void>;
  deletePersona(id: string): Promise<void>;
  ensureDefaultPersonas(): Promise<void>;
}

export interface ResourceStorageProvider {
  listResources(): Promise<ResourceSummary[]>;
  getResource(id: string): Promise<Resource | null>;
  createResource(resource: Resource): Promise<void>;
  updateResource(resource: Resource): Promise<void>;
  deleteResource(id: string): Promise<void>;
}

export interface TestInputStorageProvider {
  listTestInputs(): Promise<TestInputSummary[]>;
  getTestInput(id: string): Promise<TestInput | null>;
  createTestInput(testInput: TestInput): Promise<void>;
  updateTestInput(testInput: TestInput): Promise<void>;
  deleteTestInput(id: string): Promise<void>;
}

export interface SettingsStorageProvider {
  getSettings(): Promise<UserSettings | null>;
  saveSettings(settings: UserSettings): Promise<void>;
}
