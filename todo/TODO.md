# Fraude TODO

## Current Status
**Phase**: Service layer refactoring complete
**Next up**: Developer tooling (LLM recording, inspector) or Testing infrastructure

---

## TODO List

### Developer Tooling

#### Raw Message Viewer
- [ ] Add toggle to view raw markdown source vs rendered output
  - Shows exact string content including whitespace, newlines, escape sequences
  - Helps debug formatting/rendering issues in react-markdown
- [ ] Show message metadata (id, timestamp, token count if available)

#### LLM Call Inspector
- [ ] Create dev panel/drawer to inspect LLM calls
  - Show request: model, system prompt, messages array, options (max_tokens, etc.)
  - Show response: final assembled content
  - Show timing: request start, completion, total duration
  - Reads from LLM call recordings on disk
- [ ] Add copy-to-clipboard for request/response payloads

#### LLM Recording Service
- [ ] Create recording at API route level (server-side)
  - Instrument `/api/chat` and `/api/complete` routes
  - Save to `data/llm-calls/<conversation-id>/` directory
  - Filename: `<call-type>-<timestamp>.json` (e.g., `chat-1737561234567.json`)
  - Record: uuid, timestamp, call type, model, system prompt, messages, options, response, latency, error
- [ ] JSON format for easy inspection and loading into inspector panel

#### Simple Logging Wrapper
- [ ] Create `src/lib/logger.ts` with thin wrapper around console
  - `log.debug()`, `log.info()`, `log.warn()`, `log.error()`
  - Consistent format with timestamps
  - Single place to change behavior later if needed
- [ ] Replace direct console.log/error calls with logger

### Testing Strategy

#### Test Infrastructure Setup
- [ ] Choose test runner (Jest vs Vitest) - Vitest likely better for Next.js
- [ ] Configure test environment for TypeScript
- [ ] Set up test scripts in package.json

#### Unit Tests (no network, no UI)
- [ ] Test utility functions (`src/lib/utils.ts`)
- [ ] Test InMemoryStorageClient
- [ ] Test DefaultPromptProvider
- [ ] Test EventEmitter

#### Integration Tests (server + mocked Anthropic)
- [ ] Mock Anthropic SDK at server level
- [ ] Test full chat flow: ChatSession → API routes → mock Anthropic
- [ ] Test title generation flow
- [ ] Test conversation CRUD via ChatSession → API routes

#### Live LLM Tests (real API, no UI)
- [ ] Test harness that starts server, runs ChatSession against it
- [ ] Verify streaming works correctly end-to-end
- [ ] Test title generation produces sensible results
- [ ] Test different models behave as expected
- [ ] Test error handling with real API errors
- [ ] Use LLM recording service to capture inputs/outputs
- [ ] Flag these tests to run separately (slower, costs money, requires API key)

### Future Enhancements
- [ ] Add loading states/skeletons
- [ ] Improve error handling UI
- [ ] Add conversation search
- [ ] Deploy to Vercel

---

## Completed

### 2025-01-22 - Service Layer Refactoring
- [x] Create `src/services/` directory for client-side business logic
- [x] Create `ChatSession` class - orchestrates chat, emits events
- [x] Create `TitleService` class - generates titles via LLM
- [x] Create `APILLMClient` - HTTP client for /api/chat and /api/complete
- [x] Create `APIStorageClient` - HTTP client for /api/storage/*
- [x] Create `InMemoryStorageClient` - for testing
- [x] Create `DefaultPromptProvider` - returns system prompt
- [x] Create `EventEmitter` utility for typed events
- [x] Refactor `useChat` to be thin wrapper around ChatSession
- [x] Update `ChatView` to receive ChatSession as prop
- [x] Create ChatSession instance in page.tsx
- [x] Update `/api/chat` to use Anthropic SDK directly
- [x] Create `/api/complete` endpoint for non-streaming calls
- [x] Delete old `/api/generate-title` endpoint
- [x] Delete old `src/lib/llm/` directory
- [x] Delete old `src/lib/prompt/` directory
- [x] Update DESIGN.md with client/server architecture
- [x] Update IMPLEMENTATION.md with current structure

### 2025-01-22 - LLM-Powered Title Generation
- [x] Add title generation using Haiku 4.5
- [x] Configure utility model in config.ts

### 2024-01-21 - Initial Implementation
- [x] Initialize Next.js with TypeScript and Tailwind
- [x] Define shared types (Message, Conversation, etc.)
- [x] Implement JSON storage provider
- [x] Create storage API routes
- [x] Create chat API route (streaming)
- [x] Build UI components (Sidebar, ChatView, Message, InputArea)
- [x] Wire up main page

---

## Notes
- See `DESIGN.md` for architecture and design decisions
- See `IMPLEMENTATION.md` for implementation details
- Set `ANTHROPIC_API_KEY` environment variable before running
