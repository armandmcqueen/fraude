# Fraude Design Document

A simple, modular AI chat application built on Claude.

## Overview

Fraude is a chat application that provides a conversational interface to Claude. The initial version is a client-side focused Next.js application with local JSON storage. The architecture prioritizes modularity to enable future enhancements like server-side LLM routing, database storage, and multi-modal capabilities.

## Goals

- **Simple to start**: Minimal setup, works out of the box
- **Modular architecture**: Easy to swap storage, LLM providers, and system prompt logic
- **Real-time streaming**: Responses stream as they're generated
- **Conversation management**: Persistent conversations with a sidebar list
- **Future-ready**: Architecture supports file/image uploads without implementing them now

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Markdown | react-markdown + remark-gfm |
| Code Highlighting | react-syntax-highlighter (Prism) |
| LLM SDK | @anthropic-ai/sdk |
| State | React useState/useContext (upgrade to Zustand if needed) |
| Deployment | Vercel |

## Architecture

The architecture separates UI (React) from business logic (plain TypeScript services) to enable testing without the UI.

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer (React)                         │
│  Components: Sidebar, ChatView, InputArea, MessageList          │
│  Hooks: useChat, useConversations (thin wrappers over services) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ calls methods, subscribes to events
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer (Plain TS)                   │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   ChatSession   │  │  TitleService   │  │ RecordingService│  │
│  │                 │  │                 │  │                 │  │
│  │ - conversation  │  │ - generate()    │  │ - record()      │  │
│  │ - sendMessage() │  └────────┬────────┘  │ - getRecords()  │  │
│  │ - loadConv()    │           │           └────────┬────────┘  │
│  └────────┬────────┘           │                    │           │
│           │                    │                    │           │
│           ▼                    ▼                    ▼           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    LLMClient (interface)                 │   │
│  │  streamChat(convId, messages, systemPrompt, options)     │   │
│  │  complete(convId, systemPrompt, userPrompt, options)     │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 StorageClient (interface)                │   │
│  │  listConversations() / getConversation(id)               │   │
│  │  saveConversation(conv)                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Implementation Layer                         │
│                                                                 │
│  AnthropicLLMClient    APIStorageClient    RecordingLLMClient   │
│  MockLLMClient         InMemoryStorage     FileRecorder         │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Dependency Injection**: Services receive dependencies via constructor, not imports
2. **Thin React Hooks**: Hooks subscribe to service events and update React state; no business logic
3. **Testable Core**: ChatSession, TitleService, etc. can be tested with mock implementations
4. **Decorator Pattern**: RecordingLLMClient wraps any LLMClient to add recording

## Core Abstractions

### 1. LLMClient (interface)

Unified interface for all LLM communication. All methods include `conversationId` for recording.

```typescript
interface LLMClient {
  // Streaming chat completion
  streamChat(
    conversationId: string,
    messages: Message[],
    systemPrompt: string,
    options: LLMOptions
  ): AsyncGenerator<StreamChunk>;

  // Non-streaming completion (for utility tasks)
  complete(
    conversationId: string,
    systemPrompt: string,
    userPrompt: string,
    options: LLMOptions
  ): Promise<string>;

  getAvailableModels(): ModelInfo[];
}
```

Implementations:
- `AnthropicLLMClient` - Real API calls via @anthropic-ai/sdk
- `RecordingLLMClient` - Decorator that wraps any LLMClient and records all calls
- `MockLLMClient` - Returns canned responses for testing

### 2. StorageClient (interface)

Handles conversation persistence.

```typescript
interface StorageClient {
  listConversations(): Promise<ConversationSummary[]>;
  getConversation(id: string): Promise<Conversation | null>;
  saveConversation(conversation: Conversation): Promise<void>;
}
```

Implementations:
- `APIStorageClient` - Calls /api/storage/* endpoints
- `InMemoryStorageClient` - For testing without persistence

### 3. ChatSession (service class)

Core business logic for managing a chat conversation. Holds state, coordinates LLM and storage.

```typescript
class ChatSession {
  readonly events: EventEmitter<ChatSessionEvents>;

  constructor(deps: {
    llmClient: LLMClient;
    storageClient: StorageClient;
    titleService: TitleService;
    promptProvider: PromptProvider;
  });

  getConversation(): Conversation | null;
  loadConversation(id: string): Promise<void>;
  createNewConversation(model?: string): void;
  sendMessage(content: string): Promise<void>;
  setModel(model: string): void;
}
```

- Emits events (conversationUpdated, streamChunk, error) for UI to subscribe
- Fully testable with mock dependencies

### 4. TitleService

Generates conversation titles using a fast LLM (Haiku 4.5).

```typescript
class TitleService {
  constructor(llmClient: LLMClient);
  generate(conversationId: string, userMessage: string): Promise<string>;
}
```

### 5. RecordingService

Records all LLM calls to disk for debugging and inspection.

```typescript
class RecordingService {
  record(call: LLMCallRecord): Promise<void>;
  getRecords(conversationId: string): Promise<LLMCallRecord[]>;
}
```

### 6. PromptProvider (interface)

Retrieves system prompts.

```typescript
interface PromptProvider {
  getSystemPrompt(context: PromptContext): Promise<string>;
}
```

- Initial: Static string
- Future: Dynamic prompts based on context, user preferences

## Design Decisions

1. **Conversation titles**: Auto-generated using LLM (Haiku 4.5) based on initial user message (not user-editable)
2. **Conversation deletion**: Not supported in initial version
3. **Error handling**: Inline in the chat pane (errors displayed as message-like elements)
4. **Keyboard shortcuts**: Enter to send, Shift+Enter for newline (no additional shortcuts)
5. **UI Layout**: Sidebar (conversation list) + main chat view, desktop only

## Future Considerations

### Server-side LLM Routing
Replace direct SDK calls with API route to hide API key, add logging, rate limiting.

### Database Storage
Replace JSON files with SQLite/Postgres for better querying and scalability.

### Multi-modal Support
Extend Message type with attachments for images/files. Architecture already accommodates this.

### User Authentication
Add auth layer (NextAuth.js, Clerk) for multi-user support with user-scoped conversations.
