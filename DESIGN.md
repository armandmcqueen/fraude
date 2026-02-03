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
| Components | shadcn/ui (Radix UI primitives, incremental adoption) |
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
Core business logic for managing a single-persona chat conversation. Runs in browser.

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

#### MultiPersonaChatSession
Extends chat functionality to support multiple personas responding to each user message. Implements the same `ChatSessionInterface` as `ChatSession`.

```typescript
class MultiPersonaChatSession {
  readonly events: EventEmitter<ChatSessionEvents>;

  constructor(deps: {
    llmClient: APILLMClient;
    storageClient: StorageClient;
    titleService: TitleService;
    summaryService?: SummaryService;  // Optional for backwards compatibility
    personas: Persona[];
    orchestrator: Orchestrator;
    config?: ConversationConfig;
  });

  // Same public API as ChatSession
  getConversation(): Conversation | null;
  loadConversation(id: string): Promise<void>;
  createNewConversation(model?: string): void;
  sendMessage(content: string): Promise<void>;
  setModel(model: string): void;
  setConfig(config: ConversationConfig): void;
}
```

Key features:
- **Orchestrator pattern**: Pluggable strategy for determining which personas respond
- **Execution modes**: Sequential (one after another) or parallel (all at once)
- **Context modes**: Shared (each persona sees previous responses) or isolated (only sees user messages)
- **Claude API compatibility**: Formats conversation history with `[User]`/`[Persona]` labels since Claude requires messages ending with user role

#### Orchestration

```typescript
interface Persona {
  id: string;
  name: string;
  systemPrompt: string;
}

interface Orchestrator {
  getResponsePlan(context: OrchestrationContext): ResponsePlan;
}

type ResponsePlan = Persona[];  // Ordered list of personas to respond

interface ConversationConfig {
  executionMode: 'sequential' | 'parallel';
  contextMode: 'shared' | 'isolated';
}
```

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

#### SummaryService
Generates concise summaries of long assistant messages using a fast LLM (Haiku 4.5).

```typescript
class SummaryService {
  constructor(llmClient: APILLMClient);
  shouldSummarize(content: string): boolean;  // Threshold: 500 chars
  generate(conversationId: string, content: string, personaName?: string, userMessage?: string): Promise<string | null>;
}
```

Key features:
- Only summarizes messages above 500 characters
- Includes user's question as context for better summaries
- Summary stored on Message object, displayed by default in UI
- Toggle switch (shadcn/ui) allows viewing full content

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
3. **Conversation export**: Export to markdown or PDF via browser download/print dialog
4. **Error handling**: Inline in the chat pane (errors displayed as message-like elements)
5. **Keyboard shortcuts**: Enter to send, Shift+Enter for newline (no additional shortcuts)
6. **UI Layout**: Sidebar (conversation list) + main chat view, desktop only
7. **Testing model**: Live LLM tests start a real Next.js server and make HTTP requests (no UI). Vitest as test runner. Mock at Anthropic SDK level for fast/cheap integration tests if needed.

## Persona Editor Agent

The persona editor includes an AI assistant that can view and modify persona data through tool use.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PERSONA EDITOR UI                           │
├─────────────────────────────────────────────────────────────────┤
│  PersonaEditorView                                              │
│    ├── InstructionsEditor (left panel)                         │
│    ├── TestResponsePanel (right panel)                         │
│    ├── AgentOutputPanel (floating, ephemeral)                  │
│    └── AgentChatInput (fixed bottom)                           │
│                              │                                  │
│  useAgentChat hook           │ usePersonaEditor hook            │
│    - manages chat state      │   - manages persona state        │
│    - streams agent responses │   - auto-save, regeneration      │
│    - tracks outputImportant  │   - refreshPersona after agent   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (SSE streaming)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER SIDE                                  │
├─────────────────────────────────────────────────────────────────┤
│  /api/persona-agent/chat    - Agentic loop with tool use        │
│  /api/persona-agent/clear   - Clear conversation                │
│  /api/persona-agent/history - Get conversation history          │
│                                                                 │
│  Tools (15 total):                                              │
│    Server: web_search (Anthropic-hosted, real-time web search)  │
│    Read: get_persona, list_test_inputs, get_test_input,         │
│          list_all_personas, inspect_persona                     │
│    Test: run_test, run_all_tests                                │
│    Write: update_persona_name, update_system_prompt,            │
│           create_test_input, update_test_input,                 │
│           unlink_test_input, delete_test_input                  │
│    UI: keep_output_visible                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Panel State

The agent output panel has independent visibility and pinned states:

- **Visibility**: `visible` or `hidden`
- **Pinned**: `true` or `false` (persists across open/close)
- **Expanded**: `true` or `false` (full-screen mode)

Auto-dismiss behavior:
- Only triggers 1 second after agent finishes responding
- Disabled when pinned
- Disabled when agent calls `keep_output_visible` tool

### Tool Design Principles

1. **Read vs Write separation**: Read tools for inspection, write tools for modification
2. **Unlink vs Delete**: `unlink_test_input` removes from persona only (preferred), `delete_test_input` permanently deletes
3. **Cross-persona reference**: `list_all_personas` and `inspect_persona` allow referencing other personas (read-only)
4. **UI control**: `keep_output_visible` lets agent prevent auto-dismiss for important messages
5. **Server tools**: `web_search` is executed by Anthropic's servers, enabling real-time web access for research

## Slidegen Eval Suite

A tool for iterating on the Prompt Enhancer system prompt. The Prompt Enhancer takes raw slide content and transforms it into an image generation prompt, which is then fed to Gemini.

### Architecture

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│   UI        │ ──HTTP mutations─► │   Server    │ ──stores──────────►│ JSON Files  │
│   (React)   │ ◄──SSE events───── │             │                    │             │
└─────────────┘                    └─────────────┘                    └─────────────┘
                                          ▲
                                          │
┌─────────────┐                           │
│   Agent     │ ──tool calls─────────────►│
│   Tools     │   (mutate server state)
└─────────────┘
```

**Core Principle**: Server is single source of truth. All changes emit SSE events to UI. Both UI and agent mutations go through the server, which broadcasts changes via SSE.

### Real-Time Sync via SSE

When anything changes on the server, it emits an event:
- `config_updated` - System prompt or model settings changed
- `test_case_added` - New test case created
- `test_case_updated` - Test case modified
- `test_case_deleted` - Test case removed
- `test_result_updated` - Test progress or completion

The UI subscribes to these events and updates immediately.

### Agent Awareness via Changelog

The agent needs to know when humans made changes. Solution: **Changelog injected into agent context**.

Every mutation (UI or agent) appends to the changelog. On each agent turn, recent changelog entries are injected into the system prompt so the agent can see what the human did and respond appropriately.

### Model Configuration

The eval suite supports configurable models:
- **Enhancer Model**: Claude Haiku 4.5, Sonnet 4.5, or Opus 4.5 for prompt enhancement
- **Image Model**: Gemini 2.5 Flash or Gemini 3 Pro for image generation

Model settings are persisted with the config and included in version history.

### Version History

System prompt changes are tracked with snapshots:
- Each save increments the version number
- Snapshots store the full config state (system prompt, models, timestamp)
- Users can view history and revert to previous versions
- Test results track which config version produced them (shows "Outdated" badge when stale)

### Agent Tools (10 total)

**Read Tools**
- `get_config` - Get current system prompt and model settings
- `list_test_cases` - List all test cases with names and input text
- `get_test_result` - Get result for a specific test case

**Write Tools**
- `update_system_prompt` - Replace the system prompt (optionally with model settings)
- `create_test_case` - Create a new test case
- `update_test_case` - Modify an existing test case
- `delete_test_case` - Delete a test case

**Execution Tools**
- `run_test` - Run a single test case
- `run_all_tests` - Run all test cases

**UI Control**
- `keep_output_visible` - Prevent agent panel auto-dismiss

### Test Execution Pipeline

```
1. Create pending result → Emit test_result_updated (status: pending)
2. Call Claude with system prompt + input → Emit (status: enhancing)
3. Get enhanced prompt → Emit (status: generating_image, enhancedPrompt: "...")
4. Call Gemini with enhanced prompt → Get generated image
5. Save image → Emit (status: complete, generatedImageId: "...")
```

### UI Components

- **SlidegenEvalView** - Main layout orchestrator
- **PromptEditorModal** - Edit system prompt with version history
- **TestCaseList** - Grid of test cases with responsive layout
- **TestCaseRow** - Single test case with inline actions and result preview
- **TestCaseEditModal** - Full editing experience for test case content
- **ImageModal** - Full-screen image view with keyboard navigation
- **AgentChatPanel** - Floating agent chat with tool visualization

## Future Considerations

### LLM Call Recording
Add recording at the API route level to capture all LLM inputs/outputs for debugging.

### Database Storage
Replace JSON files with SQLite/Postgres for better querying and scalability.

### Multi-modal Support
Extend Message type with attachments for images/files. Architecture already accommodates this.

### User Authentication
Add auth layer (NextAuth.js, Clerk) for multi-user support with user-scoped conversations.
