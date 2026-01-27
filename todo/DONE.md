# Fraude - Completed Work

Historical record of completed tasks.

## 2026-01-26 - Multi-Persona Conversations

### Orchestration Layer
- Create `src/services/orchestration/` with types, orchestrators, and config
- Implement `Persona`, `Orchestrator`, `ResponsePlan`, and `ConversationConfig` types
- Create `sequentialOrchestrator` and `singlePersonaOrchestrator`
- Add config presets for sequential/parallel and shared/isolated context modes

### MultiPersonaChatSession
- Create `src/services/MultiPersonaChatSession.ts` implementing `ChatSessionInterface`
- Support sequential execution (personas respond one after another)
- Support parallel execution (all personas respond simultaneously)
- Support shared context (each persona sees previous responses) and isolated context
- Format conversation history with `[User]`/`[Persona]` labels for Claude API compatibility

### Personas
- Create `src/lib/personas.ts` with hardcoded Optimist and Critic personas
- Each persona has id, name, and system prompt

### UI Updates
- Update `Message.tsx` to display persona name above assistant messages
- Create `ConfigPanel.tsx` for switching between execution mode presets
- Update `page.tsx` to use `MultiPersonaChatSession`
- Improve auto-scroll behavior in `MessageList.tsx` (direction-based detection)

### Tests
- Create `tests/live-llm/multi-actor.test.ts` with tests for both sequential and parallel execution
- Verify parallel mode has interleaved chunks arriving within 2 seconds of each other

## 2025-01-24 - Live LLM Tests

### Comprehensive Service Tests
- Tests use real services (ChatSession, APILLMClient, TitleService, etc.) pointed at test server
- Test APILLMClient streaming responses
- Test TitleService title generation
- Test full ChatSession flow: create conversation, send message, verify title generation, verify storage
- Test multi-turn conversation with context (follow-up questions)

## 2025-01-24 - Developer Tooling

### LLM Call Inspector
- Create `/api/llm-calls` routes to list and fetch recordings
- Create `LLMInspector` component with call list and detail view
- Add toggle button in conversation header (conversation-specific filtering)
- Copy-to-clipboard for system prompt, messages, and response
- Collapsible sections (User Message & Response expanded by default)

### LLM Recording Service
- Create `src/lib/llm-recorder.ts` with `createCallRecorder()` helper
- Instrument `/api/chat` and `/api/complete` routes to record all LLM calls
- Saves to `data/llm-calls/<conversation-id>/<call-type>-<timestamp>.json`

### Simple Logging Wrapper
- Create `src/lib/logger.ts` with `log.debug()`, `log.info()`, `log.warn()`, `log.error()`
- Replace console.error calls in TitleService, chat route, and complete route

## 2025-01-23 - Test Infrastructure
- Install and configure Vitest with TypeScript
- Create `tests/live-llm/server-utils.ts` - Start/stop Next.js server for tests
- Create `tests/live-llm/chat.test.ts` - First live LLM test
- Add `npm run test` and `npm run test:live` scripts
- Verify streaming chat works end-to-end with real LLM

## 2025-01-22 - Service Layer Refactoring
- Create `src/services/` directory for client-side business logic
- Create `ChatSession` class - orchestrates chat, emits events
- Create `TitleService` class - generates titles via LLM
- Create `APILLMClient` - HTTP client for /api/chat and /api/complete
- Create `APIStorageClient` - HTTP client for /api/storage/*
- Create `InMemoryStorageClient` - for testing
- Create `DefaultPromptProvider` - returns system prompt
- Create `EventEmitter` utility for typed events
- Refactor `useChat` to be thin wrapper around ChatSession
- Update `ChatView` to receive ChatSession as prop
- Create ChatSession instance in page.tsx
- Update `/api/chat` to use Anthropic SDK directly
- Create `/api/complete` endpoint for non-streaming calls
- Delete old `/api/generate-title` endpoint
- Delete old `src/lib/llm/` and `src/lib/prompt/` directories
- Update DESIGN.md and IMPLEMENTATION.md

### LLM-Powered Title Generation
- Add title generation using Haiku 4.5
- Configure utility model in config.ts

## 2025-01-21 - Initial Implementation
- Initialize Next.js with TypeScript and Tailwind
- Define shared types (Message, Conversation, etc.)
- Implement JSON storage provider
- Create storage API routes
- Create chat API route (streaming)
- Build UI components (Sidebar, ChatView, Message, InputArea)
- Wire up main page
