# Fraude TODO

## Current Status
**Phase**: Testing & polish

---

## TODO List

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
