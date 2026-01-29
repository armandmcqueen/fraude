# Fraude - Completed Work

Historical record of completed tasks.

## 2026-01-29 - Persona Editor Chat Agent

### Backend (Milestones 1-3)
- Create agent turn types (`AgentTurn`, `UserTurn`, `AssistantTextTurn`, `ToolCallTurn`, `ToolResultTurn`)
- Create `JsonAgentSessionStorageProvider` for persisting agent chat sessions
- Implement `/api/persona-agent/chat` endpoint with full agentic loop (continues until end_turn)
- Implement `/api/persona-agent/clear` and `/api/persona-agent/history` endpoints
- Add `agentChatSessionId` field to Persona type

### Agent Tools (12 total)
- `get_persona` - get current persona details
- `update_persona_name` - update persona name
- `update_system_prompt` - update system prompt
- `list_test_inputs` - list test inputs for current persona
- `get_test_input` - get specific test input
- `create_test_input` - create and link new test input
- `update_test_input` - update test input content
- `unlink_test_input` - remove test input from persona (keeps globally, preferred)
- `delete_test_input` - permanently delete test input (use sparingly)
- `list_all_personas` - list all personas in system (read-only)
- `inspect_persona` - view another persona's details (read-only, for reference)
- `keep_output_visible` - prevent auto-dismiss for important messages

### Testing
- Create comprehensive test suite with 14 live-llm tests
- Tests cover: basic flow, tool use (read/write), agentic loop, streaming, session persistence

### UI (Milestones 4 & 5)
- Create `useAgentChat` hook for managing agent chat state and streaming
- Create `AgentChatInput` component (fixed bottom, full width input bar)
- Create `AgentOutputPanel` component (shows conversation turns with tool visualization)
- Integrate into `PersonaEditorView`
- Panel state: separate `isPanelVisible` and `isPinned` states (pinned persists across open/close)
- Auto-dismiss (1 second) only triggers after agent finishes responding
- Click panel to pin, click outside to close, click "Pinned" badge to unpin
- Expanded mode toggle for full-screen chat experience
- Visual indicators for pinned/loading states

### UI Refresh & Polish
- Add `refreshPersona` function to `usePersonaEditor` hook
- Auto-refresh persona data when agent finishes making changes
- Auto-regenerate test responses when system prompt changes or new test inputs added
- Create reusable `MarkdownContent` component (`src/components/ui/MarkdownContent.tsx`)
- Add markdown rendering to test response output and agent chat output
- Add `PersonaSwitcher` component to switch between personas in editor

### Persona Studio Navigation
- Create `/personas` page listing all personas with edit links
- Create `/personas/new` page that creates persona and redirects to editor
- Add "Persona Studio" link in sidebar footer
- Add breadcrumb navigation in editor header (Chat / Personas / [Name])

## 2026-01-29 - Persona Editor Studio

### Persona Editor
- Create persona editor studio for managing personas outside of conversations
- Add ability to create personas from scratch in the editor
- Full CRUD operations for personas in a dedicated interface

## 2026-01-27 - Persona & Resource Management

### Persona Features
- Add persona creation UI within conversations
- Add persona selection (choose which personas participate)
- Add persona ordering (control response order)
- Implement slash commands for persona management

### Resources System
- Add resources feature for providing context to personas
- Make personas and resources editable inline
- Save conversation configuration permanently

### UI Improvements
- Move settings to a modal dialog
- Add tab view for viewing multiple persona outputs side-by-side
- Add request cancellation support

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
