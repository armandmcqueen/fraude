# Fraude TODO

## Current Status
**Phase**: Persona Editor Studio implemented
**Next up**: Testing or UI polish

---

## TODO List

### Persona Management (Completed)
- [x] Add Persona types with persistence (id, name, systemPrompt, createdAt, updatedAt)
- [x] Create persona storage layer (JsonPersonaStorageProvider, APIPersonaStorageClient)
- [x] Add persona API routes (GET/POST /api/storage/personas, GET/DELETE /api/storage/personas/[id])
- [x] Create usePersonas hook for fetching, selecting, creating, and deleting personas
- [x] Create PersonaSelector component with checkboxes, create form, and delete buttons
- [x] Integrate persona selection into ConfigPanel
- [x] Lazy prepopulation of default personas (Optimist, Critic) on first access
- [x] Connect persona selection to session via setPersonas() method
- [x] Pass dynamic getPersonaName to Message component for display

### Multi-Persona Conversations (Completed)
- [x] Add Persona types and orchestration layer
- [x] Create built-in persona definitions (Optimist, Critic)
- [x] Implement MultiPersonaChatSession service with sequential and parallel modes
- [x] Update Message component to display persona name
- [x] Add ConfigPanel for switching between execution modes
- [x] Test both sequential and parallel execution

### Persona Enhancements
- [ ] Auto-generate persona description from system prompt (use LLM to create a short summary for display)
- [x] Allow users to reorder personas (up/down buttons) to control response order
- [x] Edit existing personas (name and system prompt)

### Persona Editor Studio (Completed)
- [x] Create dedicated persona editor page at `/personas/[id]`
- [x] Split panel layout: Instructions editor (left) + Test responses (right)
- [x] Auto-save with debouncing (1s delay)
- [x] Global test inputs storage (`data/test-inputs/`)
- [x] TestInput types and storage provider
- [x] API routes for test inputs (CRUD)
- [x] Client-side APITestInputStorageClient
- [x] useTestInputs hook for test input management
- [x] useDebounce hook utility
- [x] usePersonaEditor hook (manages editor state, auto-save, response generation)
- [x] Add testInputIds field to Persona type (with backwards compatibility)
- [x] Generate test responses using Haiku model via complete() API
- [x] Individual and batch response regeneration
- [x] "Edit in Studio" link in PersonaSelector to navigate to editor

### View Modes (Completed)
- [x] Focused view mode - shows one persona response at a time with tabs to switch
- [x] Toggle button in header to switch between expanded/focused views
- [ ] Micro-summaries for inactive personas in focused view (future enhancement)

### Known Issues
- [ ] **Auto-scroll hitch**: When scrolling up during streaming, there's a small hitch/stutter before auto-scroll disables. The current implementation tracks scroll direction and disables auto-scroll on upward scroll, but there's a brief fight between user scroll and auto-scroll. Potential fixes to try:
  - Use `behavior: 'instant'` instead of `'smooth'` during streaming
  - Add debounce/throttle to the scroll handler
  - Use requestAnimationFrame for scroll updates
  - Track "user is actively scrolling" state with a timeout

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
- [x] Move conversation config to a modal or collapsible section to reduce space usage
- [ ] Add loading states/skeletons
- [ ] Improve error handling UI
- [ ] Add conversation search

### Deployment
- [ ] Deploy to Vercel

---

## Notes
- See `DESIGN.md` for architecture and design decisions
- See `IMPLEMENTATION.md` for implementation details
- See `todo/DONE.md` for completed work history
- See `todo/multi_actor_conversations.md` for multi-actor feature plan
- Set `ANTHROPIC_API_KEY` environment variable before running
