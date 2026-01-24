# Fraude Design Document

A simple, modular AI chat application built on Claude.

## Overview

Fraude is a chat application that provides a conversational interface to Claude. The initial version is a client-side focused Next.js application with local JSON storage. The architecture separates client-side business logic from server-side API calls to enable testing without the UI.

## Goals

- **Simple to start**: Minimal setup, works out of the box
- **Testable**: Business logic can be tested without UI by running against the server
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
| LLM SDK | @anthropic-ai/sdk (server-side only) |
| Testing | Vitest |
| State | React useState/useContext (upgrade to Zustand if needed) |
| Deployment | Vercel |

## Architecture

Clear separation between client-side and server-side code.

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT SIDE (Browser)                       │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer (React)                                               │
│    Components: Sidebar, ChatView, InputArea, MessageList        │
│    Hooks: useChat, useConversations (thin wrappers)             │
│                              │                                  │
│                              ▼                                  │
│  Service Layer (Plain TypeScript)                               │
│    ChatSession    - orchestrates chat flow                      │
│    TitleService   - generates titles via LLM                    │
│    APILLMClient   - HTTP calls to /api/chat, /api/complete      │
│    APIStorageClient - HTTP calls to /api/storage/*              │
│    DefaultPromptProvider - returns system prompt                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER SIDE (Next.js API Routes)             │
├─────────────────────────────────────────────────────────────────┤
│  /api/chat          - streaming chat, uses Anthropic SDK        │
│  /api/complete      - non-streaming completion, uses Anthropic  │
│  /api/storage/*     - CRUD for conversations, uses JSON files   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Clear client/server boundary**: All Anthropic SDK usage is server-side only
2. **Thin React Hooks**: Hooks subscribe to service events and update React state; no business logic
3. **Testable Core**: ChatSession can be tested by running against the real server (no UI needed)
4. **Dependency Injection**: Services receive dependencies via constructor

## Core Components

### Client-Side Services

#### ChatSession
Core business logic for managing a chat conversation. Runs in browser.

```typescript
class ChatSession {
  readonly events: EventEmitter<ChatSessionEvents>;

  constructor(deps: {
    llmClient: APILLMClient;
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

Emits events (conversationUpdated, streamChunk, streamStart, streamEnd, error) for UI to subscribe.

#### APILLMClient
HTTP client for LLM operations. Calls server API routes.

```typescript
class APILLMClient {
  streamChat(conversationId, messages, systemPrompt, options): AsyncGenerator<StreamChunk>;
  complete(conversationId, systemPrompt, userPrompt, options): Promise<string>;
  getAvailableModels(): ModelInfo[];
}
```

#### TitleService
Generates conversation titles using a fast LLM (Haiku 4.5).

```typescript
class TitleService {
  constructor(llmClient: APILLMClient);
  generate(conversationId: string, userMessage: string): Promise<string>;
}
```

#### StorageClient (interface)
```typescript
interface StorageClient {
  listConversations(): Promise<ConversationSummary[]>;
  getConversation(id: string): Promise<Conversation | null>;
  saveConversation(conversation: Conversation): Promise<void>;
}
```

Implementations:
- `APIStorageClient` - Calls /api/storage/* endpoints (production)
- `InMemoryStorageClient` - For unit tests without persistence

### Server-Side API Routes

- `/api/chat` - Uses Anthropic SDK directly for streaming chat
- `/api/complete` - Uses Anthropic SDK directly for non-streaming completions
- `/api/storage/conversations` - List/create conversations (JSON files)
- `/api/storage/conversations/[id]` - Get/update specific conversation

## Design Decisions

1. **Conversation titles**: Auto-generated using LLM (Haiku 4.5) based on initial user message (not user-editable)
2. **Conversation deletion**: Not supported in initial version
3. **Error handling**: Inline in the chat pane (errors displayed as message-like elements)
4. **Keyboard shortcuts**: Enter to send, Shift+Enter for newline (no additional shortcuts)
5. **UI Layout**: Sidebar (conversation list) + main chat view, desktop only
6. **Testing model**: Live LLM tests start a real Next.js server and make HTTP requests (no UI). Vitest as test runner. Mock at Anthropic SDK level for fast/cheap integration tests if needed.

## Future Considerations

### LLM Call Recording
Add recording at the API route level to capture all LLM inputs/outputs for debugging.

### Database Storage
Replace JSON files with SQLite/Postgres for better querying and scalability.

### Multi-modal Support
Extend Message type with attachments for images/files. Architecture already accommodates this.

### User Authentication
Add auth layer (NextAuth.js, Clerk) for multi-user support with user-scoped conversations.
