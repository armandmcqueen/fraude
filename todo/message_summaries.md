# Message Summaries Feature

## Overview

Persona outputs are often too long to skim. This feature adds automatic summarization of assistant messages to improve readability while preserving full content for when it's needed.

## Goals

1. **Keep full output**: The complete response is always stored and accessible
2. **Show summary by default**: Users see a concise summary in the UI
3. **Cheap and fast**: Use a smaller model (Haiku) for summarization
4. **Future-ready**: Design supports adding "slides" view later

## Data Model

### Message Type Changes

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;           // Full original content (unchanged)
  createdAt: Date;
  personaId?: string;

  // New fields for summarization
  summary?: string;          // LLM-generated summary (assistant messages only)
  summaryModel?: string;     // Model used to generate summary
  summaryGeneratedAt?: Date; // When summary was generated
}
```

### Key Design Decisions

1. **Summary is optional**: Messages without summaries display full content
2. **Summary is immutable**: Once generated, summaries are not regenerated (content doesn't change)
3. **User messages have no summary**: Only assistant messages are summarized
4. **Model is recorded**: Track which model generated the summary for debugging/versioning

### Storage

No changes to storage structure. The existing JSON storage handles the new optional fields automatically.

## Chat History Composition

**Critical Question**: When a persona responds, should it see the full previous messages or the summaries?

### Decision: Use FULL content for LLM requests

The `formatConversationForLLM` method will continue to use `message.content` (full text), not summaries.

**Rationale**:
- Summaries lose nuance and detail that may be important for coherent multi-turn conversations
- Personas may need to reference specific points from earlier messages
- Summarization is for human readability, not LLM context
- Token cost is acceptable since we're already sending full history

```typescript
// In formatConversationForLLM (no change needed)
private formatConversationForLLM(isolatedContext: boolean = false): string {
  // Uses msg.content (full text) - summaries are ignored
  for (const msg of this.conversation.messages) {
    if (msg.role === 'user') {
      lines.push(`[User]: ${msg.content}`);  // Full content
    } else if (msg.personaId && !isolatedContext) {
      lines.push(`[${name}]: ${msg.content}`);  // Full content
    }
  }
}
```

## Summary Generation

### When to Generate

Summaries are generated immediately after the full response is complete, before saving to storage.

```
User sends message
  → Persona streams response (content accumulates)
  → Stream completes
  → Generate summary (non-blocking)
  → Update message with summary
  → Save conversation to storage
```

### Summarization Service

New service similar to `TitleService`:

```typescript
class SummaryService {
  private llmClient: APILLMClient;

  constructor(llmClient: APILLMClient) {
    this.llmClient = llmClient;
  }

  async generate(
    conversationId: string,
    content: string,
    personaName?: string
  ): Promise<string> {
    const systemPrompt = `You are a summarizer. Create a brief summary (2-4 sentences) of the following response. Focus on the key points and conclusions. Be concise.`;

    const userPrompt = personaName
      ? `Summarize this response from "${personaName}":\n\n${content}`
      : `Summarize this response:\n\n${content}`;

    const summary = await this.llmClient.complete(
      conversationId,
      systemPrompt,
      userPrompt,
      { model: 'claude-haiku-4-5-20251001', maxTokens: 256 }
    );

    return summary;
  }
}
```

### Token Efficiency

The summarization call is intentionally minimal:

**What IS sent:**
- Short system prompt (~30 tokens)
- The single message content to summarize
- No conversation history

**What is NOT sent:**
- Previous messages in the conversation
- Other personas' responses
- Any context beyond the message itself

This is achieved by using the `/api/complete` endpoint which only takes `systemPrompt` and `userPrompt` - the `conversationId` parameter is only for logging/recording, not for fetching history.

```typescript
// /api/complete sends exactly this to Anthropic:
{
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 256,
  system: systemPrompt,           // ~30 tokens
  messages: [{ role: 'user', content: userPrompt }]  // Just the message to summarize
}
```

### Model Choice

Use `claude-haiku-4-5-20251001` (same as title generation):
- Fast (low latency)
- Cheap (minimal cost per summary)
- Capable enough for summarization

### Error Handling

If summarization fails:
- Log the error
- Leave `summary` field undefined
- UI displays full content as fallback
- Don't block the main flow

## UI Changes

### MessageList / Message Component

```typescript
// Message display logic
function MessageContent({ message }: { message: Message }) {
  const [showFull, setShowFull] = useState(false);

  // User messages always show full content
  if (message.role === 'user') {
    return <MarkdownContent content={message.content} />;
  }

  // Assistant messages: show summary or full
  const hasSummary = !!message.summary;
  const displayContent = showFull || !hasSummary
    ? message.content
    : message.summary;

  return (
    <div>
      <MarkdownContent content={displayContent} />
      {hasSummary && (
        <button onClick={() => setShowFull(!showFull)}>
          {showFull ? 'Show Summary' : 'Show Full Response'}
        </button>
      )}
    </div>
  );
}
```

### Visual Indicators

- Summary view: Normal text with "Show Full Response" link
- Full view: Normal text with "Show Summary" link
- No summary (fallback): Full text, no toggle

## Integration Points

### MultiPersonaChatSession Changes

After streaming completes for each persona:

```typescript
private async streamPersonaResponse(persona: OrchestrationPersona): Promise<void> {
  // ... existing streaming code ...

  // After stream completes, generate summary
  if (personaContent.length > SUMMARY_THRESHOLD) {
    try {
      const summary = await this.summaryService.generate(
        this.conversation.id,
        personaContent,
        persona.name
      );
      this.updateMessageSummary(personaMessage.id, summary);
    } catch (error) {
      log.warn('Failed to generate summary:', error);
      // Continue without summary
    }
  }
}

private updateMessageSummary(messageId: string, summary: string): void {
  // Update message with summary fields
  const messages = this.conversation.messages.map((msg) =>
    msg.id === messageId
      ? {
          ...msg,
          summary,
          summaryModel: 'claude-haiku-4-5-20251001',
          summaryGeneratedAt: new Date()
        }
      : msg
  );
  // ... update conversation and emit event
}
```

### Summary Threshold

Only generate summaries for responses above a certain length:

```typescript
const SUMMARY_THRESHOLD = 500; // characters
```

Short responses don't need summarization.

## API Changes

No new API routes needed. Summaries are generated client-side using the existing `/api/complete` endpoint.

---

## Implementation Milestones

Each milestone is independently testable. Stop after each milestone to verify before proceeding.

---

### Milestone 1: SummaryService (Isolated) ✅

**Goal**: Create SummaryService and verify it works in isolation via live LLM test.

**Files to create/modify**:
- `src/services/SummaryService.ts` - New service
- `src/services/index.ts` - Export the service
- `tests/live-llm/summary.test.ts` - Live LLM test

**Testability**:
- SummaryService receives `APILLMClient` via constructor (dependency injection)
- Test instantiates real `APILLMClient` pointed at test server
- No app changes yet - service is tested in complete isolation

**Test command**:
```bash
npm run test:live -- summary
```

**What to verify**:
- [x] Test passes
- [x] Summary is 2-4 sentences
- [x] Summary captures key points of input text

**No manual testing** - this is purely automated.

---

### Milestone 2: Message Type Changes ✅

**Goal**: Add summary fields to Message type. Verify existing functionality still works.

**Files to modify**:
- `src/types/index.ts` - Add summary fields to Message interface

**What to verify**:
- [x] App still runs (`npm run dev`)
- [x] Existing conversations load correctly
- [x] Can send messages and receive responses
- [x] No TypeScript errors

**Manual test**: Open app, load an existing conversation, send a new message.

---

### Milestone 3: Wire SummaryService into MultiPersonaChatSession ✅

**Goal**: Generate summaries after each persona response. Summaries saved to storage.

**Files to modify**:
- `src/services/MultiActorChatSession.ts` - Add SummaryService dependency, call after streaming
- `src/app/page.tsx` - Pass SummaryService to session constructor

**Testability**:
- SummaryService is injected via constructor (can be mocked in tests)
- Add live LLM test for full flow

**Files to create**:
- `tests/live-llm/summary-integration.test.ts` - Test full chat flow with summarization

**Test command**:
```bash
npm run test:live -- summary-integration
```

**What to verify (automated)**:
- [x] Send message → response has summary field populated
- [x] Summary is stored in conversation JSON
- [x] Short responses (< threshold) have no summary

**What to verify (manual)**:
- [x] Open app, send a message that gets a long response
- [x] Check `data/conversations/<id>.json` - verify `summary` field exists on assistant message
- [x] Reload page - summary persists

---

### Milestone 4: UI - Display Summary with Toggle ✅

**Goal**: Show summary by default in Message component, with toggle to show full content.

**Files to modify**:
- `src/components/chat/Message.tsx` - Add summary display logic and toggle (uses shadcn/ui Switch)

**What to verify (manual)**:
- [x] Assistant messages show summary (shorter text) by default
- [x] Toggle switch is visible with "Summary" / "Full" labels
- [x] Clicking toggle shows full content
- [x] Clicking again shows summary
- [x] Messages without summary show full content (no toggle)
- [x] User messages unchanged

---

### Milestone 5: UI Polish - Loading State ✅

**Goal**: Show "Summarizing..." indicator while summary is being generated.

**Files to modify**:
- `src/services/types.ts` - Add `summaryStart`/`summaryEnd` events
- `src/services/MultiActorChatSession.ts` - Emit summary events
- `src/hooks/useChat.ts` - Track summarizing state
- `src/components/chat/Message.tsx` - Show indicator

**What to verify (manual)**:
- [x] After response streams complete, see "Summarizing..." briefly
- [x] Indicator disappears when summary appears
- [x] If summarization fails, indicator disappears and full content shown

---

### Milestone 6: Parallel Mode Support ✅

**Goal**: In parallel execution mode, summarize all persona responses in parallel.

**Files to modify**:
- `src/services/MultiActorChatSession.ts` - Parallel summarization in `executeParallel`

**Note**: Already implemented - each `streamPersonaResponseParallel()` call includes summary generation, and since they all run via `Promise.all()`, summaries are generated in parallel.

**What to verify (manual)**:
- [x] Switch to parallel mode in app
- [x] Send message with multiple personas
- [x] All responses get summaries
- [x] Summaries appear roughly at the same time (not sequential delay)

---

## Test Summary

| Milestone | Automated Test | Manual Test |
|-----------|---------------|-------------|
| 1. SummaryService | `npm run test:live -- summary` | None |
| 2. Message Type | Existing tests pass | App works |
| 3. Wire into Session | `npm run test:live -- summary-integration` | Check JSON files |
| 4. UI Toggle | None | Visual verification |
| 5. Loading State | None | Visual verification |
| 6. Parallel Mode | Integration test | Visual verification |

## Future: Slides View

The architecture supports adding a slides representation later:

```typescript
interface Message {
  // ... existing fields ...
  summary?: string;
  slides?: Slide[];  // Future: structured slide content
}

interface Slide {
  title: string;
  bullets: string[];
  // Could include images, charts, etc.
}
```

Slides would be generated similarly to summaries, with a different prompt that outputs structured JSON.

## Migration

Existing messages without summaries will display full content (graceful degradation). No data migration needed.

## Open Questions (Resolved)

1. **Summary length**: 2-4 sentences feels right, but may need tuning based on actual usage
2. **Re-summarization**: Should users be able to request a new summary? → Not implemented initially
3. **Streaming indicator**: Should we show "Generating summary..." after response completes? → ✅ Implemented ("Summarizing..." indicator)
4. **Parallel summarization**: In parallel mode, should we summarize all responses in parallel too? → ✅ Yes, implemented

## Post-Implementation Enhancements

1. **User message context**: The summarization prompt now includes the user's question for better context. This helps the summary accurately reflect what the persona was responding to.
