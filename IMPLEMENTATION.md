# Fraude Implementation Details

Implementation details for the current version.

## Directory Structure

```
fraude/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Main page, creates ChatSession
│   │   ├── globals.css
│   │   └── api/
│   │       ├── chat/route.ts     # Streaming chat (Anthropic SDK)
│   │       ├── complete/route.ts # Non-streaming completion (Anthropic SDK)
│   │       ├── llm-calls/        # LLM call recording inspector API
│   │       └── storage/
│   │           ├── conversations/  # CRUD for conversations
│   │           ├── personas/       # CRUD for personas
│   │           └── resources/      # CRUD for resources
│   │
│   ├── components/
│   │   ├── chat/                 # ChatView, MessageList, Message, InputArea, ModelSelector, ConfigPanel, PersonaSelector, ResourceManager
│   │   ├── inspector/            # LLMInspector (dev panel for viewing LLM calls)
│   │   └── sidebar/              # Sidebar, ConversationItem
│   │
│   ├── services/                 # Client-side business logic (plain TS)
│   │   ├── ChatSession.ts        # Core chat orchestration (single persona)
│   │   ├── MultiActorChatSession.ts # Multi-persona chat orchestration
│   │   ├── TitleService.ts       # LLM-powered title generation
│   │   ├── types.ts              # EventEmitter, ChatSessionEvents, ChatSessionInterface
│   │   ├── index.ts              # Exports
│   │   ├── llm/
│   │   │   ├── APILLMClient.ts   # HTTP client for /api/chat, /api/complete
│   │   │   └── index.ts
│   │   ├── storage/
│   │   │   ├── types.ts          # StorageClient, PersonaStorageClient, ResourceStorageClient interfaces
│   │   │   ├── APIStorageClient.ts
│   │   │   ├── APIPersonaStorageClient.ts  # HTTP client for persona CRUD
│   │   │   ├── APIResourceStorageClient.ts # HTTP client for resource CRUD
│   │   │   ├── InMemoryStorageClient.ts  # For testing
│   │   │   └── index.ts
│   │   ├── prompt/
│   │   │   ├── types.ts          # PromptProvider interface
│   │   │   ├── DefaultPromptProvider.ts
│   │   │   └── index.ts
│   │   └── orchestration/        # Multi-persona orchestration
│   │       ├── types.ts          # Persona, Orchestrator, ResponsePlan
│   │       ├── orchestrators.ts  # sequentialOrchestrator, singlePersonaOrchestrator
│   │       ├── config.ts         # ConversationConfig, CONFIG_PRESETS
│   │       └── index.ts
│   │
│   ├── lib/                      # Utilities and config
│   │   ├── config.ts             # API keys, model IDs, defaults
│   │   ├── llm-recorder.ts       # Records LLM calls to disk
│   │   ├── logger.ts             # Logging wrapper (log.debug/info/warn/error)
│   │   ├── personas.ts           # Default persona definitions for prepopulation
│   │   ├── test-inputs.ts        # Slash commands and @resource expansion
│   │   ├── utils.ts              # generateId, etc.
│   │   └── storage/              # Server-side JSON storage
│   │       ├── types.ts          # StorageProvider, PersonaStorageProvider, ResourceStorageProvider interfaces
│   │       ├── json-storage.ts   # JSON file storage for conversations
│   │       ├── json-persona-storage.ts  # JSON file storage for personas
│   │       ├── json-resource-storage.ts # JSON file storage for resources
│   │       └── index.ts
│   │
│   ├── hooks/                    # Thin React wrappers
│   │   ├── useChat.ts            # Subscribes to ChatSession events
│   │   ├── useConversations.ts   # Fetches conversation list
│   │   ├── usePersonas.ts        # Persona fetching, selection, create/delete
│   │   ├── useResources.ts       # Resource fetching, create/update/delete
│   │   └── index.ts
│   │
│   └── types/                    # Shared TypeScript types
│       └── index.ts
│
├── data/
│   ├── conversations/            # JSON conversation storage
│   ├── personas/                 # JSON persona storage
│   ├── resources/                # JSON resource storage (for @mentions)
│   └── llm-calls/                # LLM call recordings (per conversation)
│
├── tests/
│   └── live-llm/                 # Live LLM tests (real API, no UI)
│       ├── server-utils.ts       # Start/stop Next.js server
│       ├── chat.test.ts          # Chat endpoint tests
│       └── multi-actor.test.ts   # Multi-persona execution tests
│
├── vitest.config.ts              # Vitest configuration
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
  personaId?: string;  // Which persona sent this (undefined for user messages)
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

// Persona (stored)
interface Persona {
  id: string;
  name: string;
  systemPrompt: string;
  createdAt: Date;
  updatedAt: Date;
}

// PersonaSummary (for list view)
interface PersonaSummary {
  id: string;
  name: string;
}

// Resource (saved content for @mention substitution)
interface Resource {
  id: string;
  name: string;  // Reference name (e.g., "project-context" for @project-context)
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// ResourceSummary (for list view)
interface ResourceSummary {
  id: string;
  name: string;
}

// LLM Call Recording
interface LLMCallRecord {
  id: string;
  timestamp: string;
  callType: 'chat' | 'complete';
  conversationId: string;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  options: Record<string, unknown>;
  response: string | null;
  latencyMs: number;
  error: string | null;
}
```

## LLM Call Recording

All LLM API calls are recorded to `data/llm-calls/<conversation-id>/` for debugging.

- **Filename**: `<call-type>-<timestamp>.json` (e.g., `chat-1737561234567.json`)
- **Recorded on**: Both `/api/chat` and `/api/complete` routes
- **Includes**: Request details, full response, latency, and any errors

## LLM Call Inspector

A developer tool for inspecting LLM calls, accessible via the button in the conversation header.

- **Conversation-specific**: Only shows calls for the active conversation
- **Collapsible sections** with smart defaults:
  - Expanded: User Message, Response
  - Collapsed: Metadata, System Prompt, Message History, Options
- **Copy-to-clipboard** for each section
- **API routes**:
  - `GET /api/llm-calls` - List all recordings
  - `GET /api/llm-calls/[conversationId]/[filename]` - Get specific recording

## Component Props

### ChatView
- `session: ChatSession` - The chat session instance
- `conversationId: string | null` - ID to load, or null for new
- `onConversationUpdate?: () => void` - Callback when conversation saved

### MessageList
- `messages: Message[]`
- `isStreaming: boolean`

### InputArea
- `onSend: (content: string) => void`
- `disabled: boolean`
- `model: string`
- `onModelChange: (model: string) => void`

### Sidebar
- `conversations: ConversationSummary[]`
- `activeId: string | null`
- `onSelect: (id: string | null) => void`
- `onCreate: () => void`

## Data Flow

### Send Message
1. User types in InputArea, hits Enter
2. InputArea calls `onSend(content)`
3. ChatView calls `session.sendMessage(content)`
4. ChatSession:
   - Creates user Message and placeholder assistant Message
   - Emits `conversationUpdated`
   - Emits `streamStart`
   - Calls `llmClient.streamChat()` → HTTP to `/api/chat`
   - Server calls Anthropic SDK, streams response
   - For each chunk: updates assistant message, emits `streamChunk`
   - On complete: if first message, calls `titleService.generate()` → `/api/complete`
   - Saves via `storageClient.saveConversation()` → `/api/storage`
   - Emits `streamEnd`
5. useChat receives events, updates React state
6. UI re-renders with new messages

### Load Conversation
1. User clicks conversation in Sidebar
2. page.tsx sets `activeConversationId`
3. ChatView's useEffect calls `session.loadConversation(id)`
4. ChatSession fetches via `storageClient.getConversation()` → `/api/storage`
5. Emits `conversationUpdated`
6. useChat updates state, UI renders messages

### Multi-Persona Send Message
1. User types in InputArea, hits Enter
2. ChatView calls `session.sendMessage(content)`
3. MultiPersonaChatSession:
   - Creates user Message, adds to conversation
   - Gets response plan from orchestrator (list of personas)
   - **Sequential mode**: For each persona in order:
     - Creates placeholder assistant Message with `personaId`
     - Formats history with `[User]`/`[Persona]` labels
     - Streams response via `llmClient.streamChat()` → `/api/chat`
   - **Parallel mode**:
     - Creates all placeholder messages upfront
     - Captures history snapshot
     - Fires all LLM calls simultaneously
   - Generates title if first exchange
   - Saves conversation
4. useChat receives events, updates React state
5. UI re-renders showing persona names above each response

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
| ID | Purpose |
|----|---------|
| claude-haiku-4-5-20251001 | Title generation |

## API Routes

### POST /api/chat
Request:
```json
{
  "conversationId": "string",
  "messages": [{ "role": "user", "content": "..." }],
  "systemPrompt": "string",
  "options": { "model": "string", "maxTokens": 4096 }
}
```
Response: NDJSON stream of `StreamChunk`

### POST /api/complete
Request:
```json
{
  "conversationId": "string",
  "systemPrompt": "string",
  "userPrompt": "string",
  "options": { "model": "string", "maxTokens": 1024 }
}
```
Response:
```json
{ "content": "string" }
```

### GET /api/storage/conversations
Response: `ConversationSummary[]`

### POST /api/storage/conversations
Request: `Conversation`

### GET /api/storage/conversations/[id]
Response: `Conversation`

### PUT /api/storage/conversations/[id]
Request: `Conversation`

### GET /api/storage/personas
Response: `PersonaSummary[]` (prepopulates defaults if empty)

### POST /api/storage/personas
Request: `Persona`

### GET /api/storage/personas/[id]
Response: `Persona`

### DELETE /api/storage/personas/[id]
Response: `{ success: true }`

### GET /api/storage/resources
Response: `ResourceSummary[]`

### POST /api/storage/resources
Request: `Resource`

### GET /api/storage/resources/[id]
Response: `Resource`

### PUT /api/storage/resources/[id]
Request: `Resource`

### DELETE /api/storage/resources/[id]
Response: `{ success: true }`

## Testing

### Test Runner
Vitest with TypeScript support. Configured in `vitest.config.ts`.

### Test Commands
```bash
npm run test        # Run all tests
npm run test:live   # Run live LLM tests only
npm run clean       # Delete all saved data (conversations, LLM call recordings)
```

### Live LLM Tests
Tests that run against the real Anthropic API using the actual application services.

**Server Utilities** (`tests/live-llm/server-utils.ts`):
- `startServer()` - Spawns Next.js dev server on port 3939
- `stopServer()` - Gracefully shuts down the server
- `getServerUrl()` - Returns the test server URL
- `waitForServer()` - Polls until server is healthy

**Test Approach**:
Tests instantiate real services (ChatSession, APILLMClient, TitleService, etc.) configured to point at the test server. This tests the actual application code paths.

**Test Coverage**:
- `APILLMClient` - streaming responses
- `TitleService` - title generation
- `ChatSession` - full conversation flow with events, title generation, storage
- Multi-turn conversations with context
- `MultiPersonaChatSession` - sequential and parallel persona execution

**Timeouts**:
- Test timeout: 60s (for LLM response time)
- Hook timeout: 120s (for server startup)
