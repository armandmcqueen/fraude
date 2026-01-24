# Fraude TODO

## Current Status
**Phase**: Core app and developer tooling complete
**Next up**: Multi-actor conversations or testing

---

## TODO List

### Multi-Actor Conversations
See [multi_actor_conversations.md](./multi_actor_conversations.md) for full implementation plan.

- [ ] Add Actor and ActorConfig types
- [ ] Create built-in actor definitions (Optimist, Critic, Expert, Creative)
- [ ] Implement MultiActorSession service (sequential round-robin orchestration)
- [ ] Update Message component to display actor name/color
- [ ] Create ActorSelector component (enable/disable/reorder actors)
- [ ] Create ActorConfigModal for custom actor creation
- [ ] Integrate with ChatView and page.tsx
- [ ] Test and polish

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
- See `todo/multi_actor_conversations.md` for multi-actor feature plan
- Set `ANTHROPIC_API_KEY` environment variable before running
