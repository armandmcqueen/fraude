# Fraude TODO

## Current Status
**Phase**: Planning service layer refactoring
**Next up**: Service layer refactoring (extract business logic from React hooks)

---

## TODO List

### Developer Tooling

#### Raw Message Viewer
- [ ] Add toggle to view raw markdown source vs rendered output
  - Shows exact string content including whitespace, newlines, escape sequences
  - Helps debug formatting/rendering issues in react-markdown
- [ ] Show message metadata (id, timestamp, token count if available)

#### LLM Call Inspector
- [ ] Create dev panel/drawer to inspect LLM calls in real-time
  - Show request: model, system prompt, messages array, options (max_tokens, etc.)
  - Show response: final assembled content only, no need for streaming support
  - Show timing: request start, first token, completion, total duration
  - Relies on LLM call recordings.
- [ ] Add copy-to-clipboard for request/response payloads

#### LLM Recording Service
- [ ] Create recording service that persists all LLM calls to disk
  - Save to `data/llm-calls/<conversation-id>/` directory
  - Filename encodes call type and timestamp, e.g., `chat-1737561234567.json`, `utility-title-1737561234567.json`
  - Record: timestamp, call type (chat/utility), model, system prompt, messages, options, response, latency, error (if any)
  - Each llm call has a uuid
- [ ] Instrument AnthropicProvider to record chat calls (requires passing conversation ID)
- [ ] Instrument UtilityLLMService to record utility calls (requires passing conversation ID)
- [ ] JSON format for easy inspection and loading into inspector panel

#### Simple Logging Wrapper
- [ ] Create `src/lib/logger.ts` with thin wrapper around console
  - `log.debug()`, `log.info()`, `log.warn()`, `log.error()`
  - Consistent format with timestamps
  - Single place to change behavior later if needed
- [ ] Replace direct console.log/error calls with logger

### Service Layer Refactoring

Extract business logic from React hooks into testable plain TypeScript classes.

#### Core Interfaces
- [ ] Define `LLMClient` interface (streamChat, complete - both take conversationId)
- [ ] Define `StorageClient` interface (list, get, save conversations)
- [ ] Define event types for ChatSession (conversationUpdated, streamChunk, error)

#### Service Implementations
- [ ] Create `ChatSession` class
  - Holds conversation state
  - Methods: loadConversation(), createNewConversation(), sendMessage(), setModel()
  - Emits events for UI to subscribe to
  - Takes dependencies via constructor (LLMClient, StorageClient, TitleService)
- [ ] Create `TitleService` class (wraps utility LLM calls for title generation)
- [ ] Create `AnthropicLLMClient` implementing LLMClient interface
- [ ] Create `APIStorageClient` implementing StorageClient (calls /api/storage/*)
- [ ] Create `RecordingLLMClient` decorator that wraps any LLMClient and records calls

#### React Integration
- [ ] Refactor `useChat` to be thin wrapper around ChatSession
  - Takes ChatSession instance
  - Subscribes to events, updates React state
  - Exposes same API to components (conversation, isStreaming, sendMessage, etc.)
- [ ] Create ChatSession instance at app level, pass to useChat
- [ ] Verify UI still works identically after refactor

#### Mock Implementations (for testing)
- [ ] Create `MockLLMClient` that returns canned responses
- [ ] Create `InMemoryStorageClient` for tests that don't need persistence

### Testing Strategy

#### Test Infrastructure Setup
- [ ] Choose test runner (Jest vs Vitest) - Vitest likely better for Next.js/Vite compatibility
- [ ] Configure test environment for TypeScript
- [ ] Set up test scripts in package.json

#### Unit Tests (no network, no UI)
- [ ] Test utility functions (`src/lib/utils.ts`)
- [ ] Test storage provider with mock filesystem or in-memory adapter
- [ ] Test prompt provider
- [ ] Test LLM recording service (once built)
- [ ] Test logger wrapper (once built)

#### Integration Tests (mock LLM API)
- [ ] Create mock LLM provider that returns canned responses
- [ ] Test chat flow: send message → get response → save conversation
- [ ] Test title generation flow
- [ ] Test conversation CRUD operations via API routes

#### Live LLM Tests (real API, no UI)
- [ ] Test harness that runs chat flows against real Anthropic API
- [ ] Verify streaming works correctly end-to-end
- [ ] Test title generation produces sensible results
- [ ] Test different models behave as expected
- [ ] Test error handling with real API errors (invalid key, rate limits, etc.)
- [ ] Use LLM recording service to capture inputs/outputs for inspection
- [ ] Consider: assertions on response quality? Or just smoke tests + manual review?
- [ ] Flag these tests to run separately (slower, costs money, requires API key)

#### Design for Testability
- [ ] Ensure providers use dependency injection (pass dependencies, don't import singletons)
- [ ] Keep business logic out of React components - components should just call hooks/services
- [ ] API routes should be thin wrappers around testable service functions
- [ ] Consider: extract core logic from `useChat` hook into a testable service class?

### Future Enhancements
- [ ] Add loading states/skeletons
- [ ] Improve error handling UI
- [ ] Add conversation search
- [ ] Deploy to Vercel

---

## Completed

### 2025-01-22 - LLM-Powered Title Generation
- [x] Create UtilityLLMService for non-streaming tasks
- [x] Add `/api/generate-title` endpoint
- [x] Update useChat to call title generation API
- [x] Configure Haiku 4.5 as utility model
- [x] Update CLAUDE.md with documentation requirements
- [x] Update DESIGN.md with Utility LLM Service section
- [x] Update IMPLEMENTATION.md with new files and data flow

### 2024-01-21 - Initial Implementation
- [x] Initialize Next.js with TypeScript and Tailwind
- [x] Configure project structure
- [x] Set up ESLint
- [x] Define shared types (Message, Conversation, etc.)
- [x] Create provider interfaces (LLM, Storage, Prompt)
- [x] Implement JSON storage provider
- [x] Create API routes for storage
- [x] Implement Anthropic LLM provider
- [x] Create chat API route (for streaming)
- [x] Implement default prompt provider
- [x] Build UI components (Sidebar, ChatView, Message, InputArea)
- [x] Wire up main page

---

## Notes
- See `DESIGN.md` for architecture and design decisions
- See `IMPLEMENTATION.md` for implementation details
- Set `ANTHROPIC_API_KEY` environment variable before running
