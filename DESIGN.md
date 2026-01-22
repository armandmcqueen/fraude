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

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                             │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │ ConversationList│  │          ChatView                │  │
│  │                 │  │  ┌────────────────────────────┐  │  │
│  │  - New Chat     │  │  │      MessageList           │  │  │
│  │  - Conv 1       │  │  │  - Message (user)          │  │  │
│  │  - Conv 2       │  │  │  - Message (assistant)     │  │  │
│  │  - Conv 3       │  │  │  - ...                     │  │  │
│  │                 │  │  └────────────────────────────┘  │  │
│  │                 │  │  ┌────────────────────────────┐  │  │
│  │                 │  │  │      InputArea             │  │  │
│  │                 │  │  │  - ModelSelector           │  │  │
│  │                 │  │  │  - TextInput               │  │  │
│  │                 │  │  │  - SendButton              │  │  │
│  │                 │  │  └────────────────────────────┘  │  │
│  └─────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │   LLMProvider   │  │ StorageProvider │  │PromptProvider│ │
│  │                 │  │                 │  │             │  │
│  │  streamMessage()│  │  list()         │  │ getSystem() │  │
│  │  getModels()    │  │  get/save/update│  │             │  │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┘  │
└───────────┼─────────────────────┼───────────────────────────┘
            │                     │
            ▼                     ▼
┌─────────────────────┐  ┌─────────────────────┐
│   Anthropic SDK     │  │   JSON Files        │
│   (replaceable)     │  │   (replaceable)     │
└─────────────────────┘  └─────────────────────┘
```

## Core Abstractions

### 1. LLM Provider

Handles communication with the language model.

```typescript
interface LLMProvider {
  streamMessage(
    messages: Message[],
    systemPrompt: string,
    options: LLMOptions
  ): AsyncGenerator<StreamChunk>;

  getAvailableModels(): ModelInfo[];
}
```

- Initial: Direct Anthropic SDK calls
- Future: API route proxy, multiple providers

### 2. Storage Provider

Handles conversation persistence.

```typescript
interface StorageProvider {
  listConversations(): Promise<ConversationSummary[]>;
  getConversation(id: string): Promise<Conversation | null>;
  createConversation(conversation: Conversation): Promise<void>;
  updateConversation(conversation: Conversation): Promise<void>;
}
```

- Initial: JSON files via Next.js API routes
- Future: Database (SQLite, Postgres, etc.)

### 3. Prompt Provider

Retrieves system prompts.

```typescript
interface PromptProvider {
  getSystemPrompt(context: PromptContext): Promise<string>;
}
```

- Initial: Static string
- Future: Dynamic prompts based on context, user preferences

## Design Decisions

1. **Conversation titles**: Auto-generated from first message + response (not user-editable)
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
