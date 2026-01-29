# Fraude TODO

## Current Status
**Phase**: Persona Editor Agent - COMPLETE
**Next up**: Testing & polish

---

## TODO List

### Persona Editor Chat Agent ✓ COMPLETE
- [x] Design doc: `todo/persona_editor_agent.md`

#### Phase 0: Test Infrastructure (FIRST) ✓ COMPLETE
- [x] Create `tests/live-llm/persona-agent.test.ts`
- [x] Create test utilities (sendAgentMessage, createTestPersona, etc.)
- [x] Write failing tests: basic agent flow (2 tests)
- [x] Write failing tests: tool use - get_persona, list_test_inputs (2 tests)
- [x] Write failing tests: tool use - update_*, create_*, unlink_* (4 tests)
- [x] Write failing tests: agentic loop - multiple tool calls until end_turn (1 test)
- [x] Write failing tests: streaming events (2 tests)
- [x] Write failing tests: session persistence & clear (3 tests)

**Total: 14 tests ready** - Run with: `npm test -- --run tests/live-llm/persona-agent.test.ts`
(Stop any running dev server first)

#### Phase 1-3: Backend Implementation ✓ COMPLETE
- [x] Create turn types (`AgentTurn`, etc.) in `src/types`
- [x] Create agent session storage (`JsonAgentSessionStorageProvider`)
- [x] Create `/api/persona-agent/chat` endpoint with full agentic loop
- [x] Create tool definitions (9 tools including unlink and delete)
- [x] Create tool executor
- [x] Implement agentic loop (continues until end_turn)
- [x] Create `/api/persona-agent/clear` endpoint
- [x] Create `/api/persona-agent/history` endpoint
- [x] **ALL 14 TESTS PASSING** ✓

#### Phase 4: Milestone 4 - Minimal UI ✓ COMPLETE
- [x] Create `useAgentChat` hook
- [x] Create `AgentChatInput` component (fixed bottom, full width)
- [x] Create `AgentOutputPanel` component (shows turns)
- [x] Wire up to PersonaEditorView
- [x] Streaming text, tool calls, tool results display
- [x] **USER TEST**: chat in browser, see changes in editor ✓

#### Phase 5: Milestone 5 - Full UI ✓ COMPLETE
- [x] Implement auto-dismiss behavior (5 second timer)
- [x] Panel state machine (HIDDEN/VISIBLE/PINNED)
- [x] Click to pin, click outside to close, click "Pinned" to unpin
- [x] Visual indicator for pinned state
- [x] Loading spinner in panel header
- [x] **USER TEST**: full ephemeral panel experience ✓

#### Phase 6: Polish ✓ COMPLETE
- [x] Auto-refresh UI when agent modifies persona data (`refreshPersona` in usePersonaEditor)
- [x] Separate unlink vs delete tools with system prompt guidance
- [x] Markdown rendering in test responses and agent output (`MarkdownContent` component)

### Testing

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
- [ ] Test API errors and timeouts

#### Live LLM Tests (real API, no UI)
- [ ] Test different models behave as expected
- [ ] Test error handling with real API errors

### Resource Enhancements
- [ ] Autocomplete/suggested options for @mentions in input area

### UI Polish
- [ ] Add loading states/skeletons
- [ ] Improve error handling UI

### Deployment
- [ ] Deploy to Vercel

---

## Notes
- See `DESIGN.md` for architecture and design decisions
- See `IMPLEMENTATION.md` for implementation details
- See `todo/DONE.md` for completed work history
- See `todo/persona_editor_agent.md` for persona editor agent design
- Set `ANTHROPIC_API_KEY` environment variable before running
