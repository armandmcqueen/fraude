# Fraude Implementation Plan

Implementation details for the initial version. This document will evolve as we build.

## Directory Structure

```
fraude/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── chat/             # Chat streaming endpoint
│   │       ├── generate-title/   # LLM-powered title generation
│   │       └── storage/          # Storage API routes
│   │
│   ├── components/
│   │   ├── chat/                 # Chat UI components
│   │   ├── sidebar/              # Sidebar components
│   │   └── ui/                   # Generic UI components
│   │
│   ├── services/                 # Business logic (plain TS, no React)
│   │   ├── ChatSession.ts        # Core chat orchestration
│   │   ├── TitleService.ts       # LLM-powered title generation
│   │   ├── RecordingService.ts   # LLM call recording to disk
│   │   ├── llm/
│   │   │   ├── types.ts          # LLMClient interface
│   │   │   ├── AnthropicLLMClient.ts
│   │   │   ├── RecordingLLMClient.ts  # Decorator
│   │   │   └── MockLLMClient.ts       # For testing
│   │   ├── storage/
│   │   │   ├── types.ts          # StorageClient interface
│   │   │   ├── APIStorageClient.ts
│   │   │   └── InMemoryStorageClient.ts  # For testing
│   │   └── prompt/
│   │       ├── types.ts          # PromptProvider interface
│   │       └── DefaultPromptProvider.ts
│   │
│   ├── lib/                      # Utilities and config
│   │   ├── config.ts
│   │   ├── utils.ts
│   │   └── logger.ts             # Simple logging wrapper
│   │
│   ├── hooks/                    # Thin React wrappers over services
│   │   ├── useChat.ts            # Subscribes to ChatSession events
│   │   └── useConversations.ts
│   │
│   └── types/                    # Shared types
│
├── data/
│   ├── conversations/            # JSON conversation storage
│   └── llm-calls/                # LLM call recordings
│       └── <conversation-id>/
│           ├── chat-<timestamp>.json
│           └── utility-title-<timestamp>.json
│
└── ...config files
```

## Type Definitions

```typescript
// Message
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

// Conversation
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

// ConversationSummary (for list view)
interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: Date;
  messageCount: number;
}

// Streaming
interface StreamChunk {
  type: 'text' | 'error' | 'done';
  content?: string;
  error?: string;
}

// LLM Options
interface LLMOptions {
  model: string;
  maxTokens?: number;
}

// Model Info
interface ModelInfo {
  id: string;
  name: string;
}

// Prompt Context
interface PromptContext {
  conversationId?: string;
  model: string;
}
```

## Component Breakdown

### ChatView
- Props: `conversationId: string | null`
- Loads conversation, coordinates MessageList and InputArea
- Manages streaming state

### MessageList
- Props: `messages: Message[]`, `isStreaming: boolean`
- Scrollable container, auto-scroll on new messages

### Message
- Props: `message: Message`, `isStreaming?: boolean`
- Renders markdown, highlights code
- Visual distinction for user vs assistant

### InputArea
- Props: `onSend`, `disabled`, `model`, `onModelChange`
- Multi-line input, Enter to send, model selector

### Sidebar
- Props: `activeId`, `onSelect`, `onCreate`
- Lists conversations sorted by updatedAt

## Data Flow

### Send Message
1. User submits in InputArea
2. ChatView creates user Message, adds to state
3. Creates empty assistant Message
4. Calls LLM provider stream
5. Appends chunks to assistant message
6. On complete:
   - If first message: call `/api/generate-title` to get LLM-generated title (uses Haiku 4.5)
   - Save conversation with generated title

### Load Conversations
1. On mount: fetch conversation list
2. On select: fetch full conversation
3. Display in ChatView

## Available Models

### Chat Models (user-selectable)
| ID | Name |
|----|------|
| claude-sonnet-4-5-20250929 | Claude Sonnet 4.5 |
| claude-haiku-4-5-20251001 | Claude Haiku 4.5 |
| claude-opus-4-5-20251101 | Claude Opus 4.5 |
| claude-opus-4-1-20250805 | Claude Opus 4.1 |
| claude-sonnet-4-20250514 | Claude Sonnet 4 |
| claude-3-7-sonnet-20250219 | Claude Sonnet 3.7 |
| claude-3-haiku-20240307 | Claude Haiku 3 |

### Utility Model (internal)
| ID | Name | Purpose |
|----|------|---------|
| claude-haiku-4-5-20251001 | Claude Haiku 4.5 | Title generation and other utility tasks |

## Implementation Order

1. Project setup (Next.js, TypeScript, Tailwind)
2. Type definitions
3. Storage provider + API routes
4. LLM provider
5. UI components
6. Integration and polish
