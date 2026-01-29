// Core message type
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  personaId?: string; // Which persona sent this (undefined for user messages)
}

// Full conversation with messages
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

// Summary for list view (without full messages)
export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: Date;
  messageCount: number;
}

// Streaming chunk from LLM
export interface StreamChunk {
  type: 'text' | 'error' | 'done';
  content?: string;
  error?: string;
}

// Options for LLM requests
export interface LLMOptions {
  model: string;
  maxTokens?: number;
}

// Model information
export interface ModelInfo {
  id: string;
  name: string;
}

// Context for system prompt generation
export interface PromptContext {
  conversationId?: string;
  model: string;
}

// Persona types
export interface Persona {
  id: string;
  name: string;
  systemPrompt: string;
  testInputIds: string[];  // References to test inputs for persona editor
  hidden?: boolean;  // Hidden until first edit (for new personas)
  createdAt: Date;
  updatedAt: Date;
}

// Test input for persona editor
export interface TestInput {
  id: string;
  content: string;  // The test prompt
  createdAt: Date;
  updatedAt: Date;
}

// Summary for list view
export interface TestInputSummary {
  id: string;
  content: string;  // Short enough to show in list
}

// Summary for list view (without full system prompt)
export interface PersonaSummary {
  id: string;
  name: string;
}

// Saved resource for @-mention substitution
export interface Resource {
  id: string;
  name: string;  // Reference name (e.g., "project-context" for @project-context)
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// Summary for list view
export interface ResourceSummary {
  id: string;
  name: string;
}

// View mode for message display
export type ViewMode = 'expanded' | 'focused';

// User settings (persisted preferences)
export interface UserSettings {
  selectedPersonaIds: string[];
  viewMode?: ViewMode;
}
