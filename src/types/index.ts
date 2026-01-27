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
  createdAt: Date;
  updatedAt: Date;
}

// Summary for list view (without full system prompt)
export interface PersonaSummary {
  id: string;
  name: string;
}
