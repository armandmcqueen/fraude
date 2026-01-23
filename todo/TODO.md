# Fraude TODO

## Current Status
**Phase**: Initial implementation complete
**Next up**: Testing with real API key

---

## TODO List

### Testing
- [ ] Test with real Anthropic API key
- [ ] Verify streaming works correctly
- [ ] Test conversation persistence
- [ ] Test model selection

### Future Enhancements
- [ ] Add loading states/skeletons
- [ ] Improve error handling UI
- [ ] Add conversation search
- [ ] Deploy to Vercel

---

## Completed

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
