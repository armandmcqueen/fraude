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
│   │   └── api/storage/          # Storage API routes
│   │
│   ├── components/
│   │   ├── chat/                 # Chat UI components
│   │   ├── sidebar/              # Sidebar components
│   │   └── ui/                   # Generic UI components
│   │
│   ├── lib/
│   │   ├── llm/                  # LLM provider
│   │   ├── storage/              # Storage provider
│   │   ├── prompt/               # Prompt provider
│   │   └── config.ts
│   │
│   ├── hooks/                    # Custom React hooks
│   └── types/                    # Shared types
│
├── data/conversations/           # JSON storage
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
6. On complete: save conversation, generate title if first message

### Load Conversations
1. On mount: fetch conversation list
2. On select: fetch full conversation
3. Display in ChatView

## Available Models

| ID | Name |
|----|------|
| claude-sonnet-4-20250514 | Claude Sonnet 4 |
| claude-opus-4-20250514 | Claude Opus 4 |
| claude-haiku-3-5-20241022 | Claude 3.5 Haiku |

## Implementation Order

1. Project setup (Next.js, TypeScript, Tailwind)
2. Type definitions
3. Storage provider + API routes
4. LLM provider
5. UI components
6. Integration and polish
