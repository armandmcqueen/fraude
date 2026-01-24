# Fraude TODO

## Current Status
**Phase**: Core app and developer tooling complete
**Next up**: Testing or UI polish

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

#### Live LLM Tests (real API, no UI)
- [ ] Test title generation produces sensible results
- [ ] Test different models behave as expected
- [ ] Test error handling with real API errors

### UI Polish
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
- Set `ANTHROPIC_API_KEY` environment variable before running
