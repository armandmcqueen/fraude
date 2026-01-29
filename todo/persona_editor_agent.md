# Persona Editor Chat Agent

Design document for adding an AI chat agent to the persona editor that can modify persona data through tool use.

## Overview

Add a chat-based interface to the persona editor where users can interact with an AI agent to modify their persona. The agent has access to tools for viewing and editing persona properties, managing test inputs, and more.

The key design principle: **the agent output is often not important to see, but sometimes it is**. The UI reflects this with an ephemeral output panel that auto-dismisses but can be re-exposed.

## Goals

- **Conversational editing**: Users can describe changes in natural language
- **Tool-based actions**: Agent uses structured tools to make changes (not free-form text parsing)
- **Full transparency**: Every turn (text, tool call, tool result) is a first-class item that can be displayed
- **Streaming**: Everything streams to the client as it happens
- **Ephemeral UI**: Agent output doesn't dominate the screen but is accessible when needed

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT SIDE (Browser)                       │
├─────────────────────────────────────────────────────────────────┤
│  Persona Editor Page                                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  System Prompt Editor, Test Inputs, etc.                  │  │
│  │  (existing persona editor content)                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Agent Output Panel (ephemeral, overlays content)         │  │
│  │  - Shows conversation turns as they stream                │  │
│  │  - Auto-dismisses after ~5 seconds of inactivity          │  │
│  │  - Can be re-exposed with button                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Chat Input (full width, bottom of page)                  │  │
│  │  [Show output] button when panel is hidden                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (SSE streaming)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER SIDE (Next.js API Routes)             │
├─────────────────────────────────────────────────────────────────┤
│  /api/persona-agent/chat                                        │
│    - Receives user message + persona ID                         │
│    - Loads chat session for persona                             │
│    - Runs agentic loop until end_turn stop reason               │
│    - Streams all turns (text, tool calls, tool results)         │
│    - Executes tools in-process                                  │
│    - Saves updated chat session                                 │
│                                                                 │
│  /api/persona-agent/clear                                       │
│    - Creates new chat session for persona                       │
│    - Links persona to new session                               │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Conversation as Flat Turn Sequence

The conversation is a flat list of turns, not nested messages. This allows sequences like:
`[user] → [assistant_text] → [tool_call] → [tool_result] → [tool_call] → [tool_result] → [assistant_text]`

```typescript
interface AgentChatSession {
  id: string;
  personaId: string;
  turns: AgentTurn[];
  createdAt: Date;
  updatedAt: Date;
}

// Discriminated union for turn types
type AgentTurn =
  | UserTurn
  | AssistantTextTurn
  | ToolCallTurn
  | ToolResultTurn;

interface UserTurn {
  type: 'user';
  id: string;
  content: string;
  createdAt: Date;
}

interface AssistantTextTurn {
  type: 'assistant_text';
  id: string;
  content: string;
  createdAt: Date;
}

interface ToolCallTurn {
  type: 'tool_call';
  id: string;           // Unique turn ID
  toolUseId: string;    // Anthropic's tool_use ID (needed for tool_result)
  toolName: string;
  input: Record<string, unknown>;
  createdAt: Date;
}

interface ToolResultTurn {
  type: 'tool_result';
  id: string;
  toolUseId: string;    // References the tool_call
  output: string;
  isError?: boolean;
  createdAt: Date;
}
```

### Persona Extension

Add chat session link to Persona:

```typescript
interface Persona {
  // ... existing fields
  agentChatSessionId?: string;  // Current chat session (null if never used)
}
```

### Storage

Store chat sessions in `data/agent-sessions/<session-id>.json`

## Tools

The agent has access to these tools:

### get_persona
Returns the current persona data (name, system prompt, test input IDs).

```typescript
// No input required - operates on current persona
// Output: { name, systemPrompt, testInputIds }
```

### update_persona_name
Changes the persona's display name.

```typescript
// Input: { name: string }
// Output: success confirmation
```

### update_system_prompt
Replaces the entire system prompt.

```typescript
// Input: { systemPrompt: string }
// Output: success confirmation
```

### list_test_inputs
Returns all test inputs linked to this persona.

```typescript
// No input required
// Output: { testInputs: [{ id, content }] }
```

### get_test_input
Gets a specific test input by ID.

```typescript
// Input: { id: string }
// Output: { id, content }
```

### create_test_input
Creates a new test input and links it to the persona.

```typescript
// Input: { content: string }
// Output: { id, content }
```

### update_test_input
Updates an existing test input's content.

```typescript
// Input: { id: string, content: string }
// Output: success confirmation
```

### delete_test_input
Deletes a test input and removes it from persona's list.

```typescript
// Input: { id: string }
// Output: success confirmation
```

## Agent Loop

The server-side agent loop runs until Claude returns `stop_reason: "end_turn"`:

```
1. Receive user message and persona ID
2. Load or create chat session for persona
3. Append user turn to session
4. LOOP:
   a. Call Anthropic API with:
      - System prompt (with project context)
      - Tool definitions
      - Full turn history (converted to Claude message format)
   b. Stream response, emitting events for:
      - Text chunks (as they arrive)
      - Tool calls (when complete)
   c. Append assistant_text turn(s) and tool_call turn(s) to session
   d. If stop_reason == "end_turn": EXIT LOOP
   e. If stop_reason == "tool_use":
      - Execute each tool call in-process
      - Append tool_result turn for each
      - Stream tool_result events to client
      - CONTINUE LOOP
5. Save session
```

### Converting Turns to Claude Messages

When sending to the Anthropic API, we need to convert our flat turn sequence into Claude's message format:

```typescript
// Our turns:
[user, assistant_text, tool_call, tool_result, assistant_text]

// Becomes Claude messages:
[
  { role: "user", content: "..." },
  { role: "assistant", content: [
    { type: "text", text: "..." },
    { type: "tool_use", id: "...", name: "...", input: {...} }
  ]},
  { role: "user", content: [
    { type: "tool_result", tool_use_id: "...", content: "..." }
  ]},
  { role: "assistant", content: [
    { type: "text", text: "..." }
  ]}
]
```

### Agent System Prompt

The system prompt needs context about the overall project. To be fleshed out, but structure:

```
You are an AI assistant helping to edit a persona for a multi-persona chat application.

## Project Context
Fraude is a chat application where users can create multiple AI personas, each with their own system prompt. When users chat, multiple personas can respond to each message (sequentially or in parallel). This allows for different perspectives, debate, or specialized expertise.

## Your Role
You are helping the user edit a specific persona. You can:
- View and modify the persona's name
- View and modify the persona's system prompt
- Manage test inputs (prompts used to test how the persona responds)

## Current Persona
ID: {personaId}
Name: {personaName}

## Guidelines
- Be concise - the user can see the changes you make in the UI
- When editing the system prompt, preserve the user's intent and writing style
- Ask for clarification if the request is ambiguous
- After making changes, briefly confirm what you did

[TODO: Add more context about what makes a good persona, examples, etc.]
```

## API Endpoints

### POST /api/persona-agent/chat

Request:
```typescript
{
  personaId: string;
  message: string;
}
```

Response: Server-Sent Events stream

```typescript
// Text chunk (may arrive multiple times as text streams)
{ type: "text_delta", content: "I'll help you..." }

// Text turn complete
{ type: "text_complete", id: string, content: string }

// Tool call
{ type: "tool_call", id: string, toolUseId: string, toolName: string, input: object }

// Tool result
{ type: "tool_result", id: string, toolUseId: string, output: string, isError?: boolean }

// Agent turn complete (stop_reason was end_turn)
{ type: "done" }

// Error
{ type: "error", message: string }
```

### POST /api/persona-agent/clear

Request:
```typescript
{
  personaId: string;
}
```

Response:
```typescript
{
  sessionId: string;  // New session ID
}
```

### GET /api/persona-agent/history

Request (query params):
```typescript
{
  personaId: string;
}
```

Response:
```typescript
{
  turns: AgentTurn[];
}
```

## UI Design

### Layout

The persona editor page has three layers:

1. **Base content** (existing): System prompt editor, test inputs/outputs, persona settings
2. **Agent output panel** (new): Overlays base content, shows agent conversation
3. **Chat input** (new): Fixed at bottom, full width

### Chat Input Bar

- Fixed to bottom of viewport
- Full width (with appropriate padding)
- Simple text input + send button
- "Show output" button appears when panel is hidden
- Feels like you're chatting with the entire page

### Agent Output Panel

- Appears above the chat input when there's output to show
- Overlays the base content (like a large toast/popover)
- Shows the turn sequence:
  - User messages: simple text
  - Assistant text: markdown rendered
  - Tool calls: collapsible, shows tool name and input
  - Tool results: collapsible, shows output
- Auto-dismisses after ~5 seconds of inactivity (no new content, no user interaction)
- User can:
  - Click panel to prevent auto-dismiss
  - Click "Show output" to re-expose after dismiss
  - Scroll through history
  - Clear conversation

### Panel Behavior

```
State machine:

HIDDEN → (user sends message) → VISIBLE
VISIBLE → (stream active) → VISIBLE (reset timer)
VISIBLE → (5s inactivity) → HIDDEN
VISIBLE → (user clicks panel) → PINNED
PINNED → (user clicks away or dismiss button) → HIDDEN
HIDDEN → (user clicks "Show output") → PINNED
```

## Testing Strategy

Testing is the top priority. We start with live-llm tests that exercise the full agent flow.

### Test Infrastructure

Use existing `tests/live-llm/server-utils.ts` to start/stop Next.js server.

New test file: `tests/live-llm/persona-agent.test.ts`

### Test Cases

#### Basic Agent Flow
```typescript
it('should respond to a simple message', async () => {
  // Create a test persona
  // Send a message like "What is this persona's name?"
  // Verify agent uses get_persona tool
  // Verify we get text response with the name
  // Verify turns are saved to session
});
```

#### Tool Use - Read Operations
```typescript
it('should use get_persona tool when asked about the persona', async () => {
  // Send: "Show me the current system prompt"
  // Expect: get_persona tool call
  // Verify: response contains the system prompt content
});

it('should use list_test_inputs tool', async () => {
  // Create persona with test inputs
  // Send: "What test inputs do I have?"
  // Expect: list_test_inputs tool call
  // Verify: response lists the test inputs
});
```

#### Tool Use - Write Operations
```typescript
it('should update persona name', async () => {
  // Send: "Change the name to 'Helpful Assistant'"
  // Expect: update_persona_name tool call with { name: "Helpful Assistant" }
  // Verify: persona is updated in storage
  // Verify: response confirms the change
});

it('should update system prompt', async () => {
  // Send: "Add 'Be concise' to the system prompt"
  // Expect: get_persona (to read current), then update_system_prompt
  // Verify: persona system prompt is updated
});

it('should create test input', async () => {
  // Send: "Add a test input: 'What is 2+2?'"
  // Expect: create_test_input tool call
  // Verify: test input exists in storage
  // Verify: persona.testInputIds includes new ID
});

it('should delete test input', async () => {
  // Create persona with test input
  // Send: "Delete the test input about math"
  // Expect: list_test_inputs, then delete_test_input
  // Verify: test input removed from storage
});
```

#### Agentic Loop (Multiple Tool Calls)
```typescript
it('should handle multi-step tasks', async () => {
  // Send: "Show me all test inputs and add a new one about coding"
  // Expect: list_test_inputs, then create_test_input
  // Both in same agent turn (loop continues until end_turn)
});

it('should loop until end_turn', async () => {
  // Send complex request requiring multiple tools
  // Verify stop_reason progression: tool_use -> tool_use -> end_turn
  // Verify all tool results are in the turn sequence
});
```

#### Streaming
```typescript
it('should stream text deltas', async () => {
  // Send message
  // Collect SSE events
  // Verify text_delta events arrive before text_complete
});

it('should stream tool calls and results', async () => {
  // Send message that triggers tool use
  // Verify event sequence: text_delta* -> tool_call -> tool_result -> text_delta* -> done
});
```

#### Session Persistence
```typescript
it('should persist conversation across requests', async () => {
  // Send first message
  // Send follow-up message
  // Verify second response has context from first
  // Verify all turns saved in session
});

it('should clear conversation and start fresh', async () => {
  // Send message, get response
  // Call clear endpoint
  // Send new message
  // Verify agent has no memory of previous conversation
  // Verify persona linked to new session
});
```

#### Error Handling
```typescript
it('should handle tool execution errors gracefully', async () => {
  // Mock a tool to fail
  // Verify error is recorded as tool_result with isError: true
  // Verify agent can recover and respond
});
```

### Test Utilities

```typescript
// Helper to send message and collect all SSE events
async function sendAgentMessage(
  personaId: string,
  message: string
): Promise<{
  events: AgentStreamEvent[];
  turns: AgentTurn[];
}>;

// Helper to create a test persona
async function createTestPersona(overrides?: Partial<Persona>): Promise<Persona>;

// Helper to verify turn sequence
function expectTurnSequence(
  turns: AgentTurn[],
  expected: Array<'user' | 'assistant_text' | 'tool_call' | 'tool_result'>
): void;
```

## Milestones (User-Testable Checkpoints)

### Milestone 1: Agent Responds
**Goal**: Send a message, get a streaming text response (no tools yet)

**How to test**:
```bash
curl -X POST http://localhost:3000/api/persona-agent/chat \
  -H "Content-Type: application/json" \
  -d '{"personaId": "optimist", "message": "Hello, who are you?"}'
```
- Should see SSE stream with text_delta events
- Should end with done event
- No tool use yet - just proves the basic loop works

**What's implemented**:
- `/api/persona-agent/chat` endpoint
- Basic streaming response
- Agent session creation/storage

---

### Milestone 2: Agent Reads Data
**Goal**: Agent can use read-only tools to answer questions about the persona

**How to test**:
```bash
curl -X POST http://localhost:3000/api/persona-agent/chat \
  -H "Content-Type: application/json" \
  -d '{"personaId": "optimist", "message": "What is this personas system prompt?"}'
```
- Should see tool_call event for `get_persona`
- Should see tool_result event with persona data
- Should see text response describing the persona

**What's implemented**:
- Tool definitions for read operations
- Tool executor
- Agentic loop (continues after tool use)

---

### Milestone 3: Agent Modifies Data
**Goal**: Agent can use write tools to change persona/test inputs

**How to test**:
```bash
# Update name
curl -X POST http://localhost:3000/api/persona-agent/chat \
  -H "Content-Type: application/json" \
  -d '{"personaId": "optimist", "message": "Change the name to Super Optimist"}'

# Verify change persisted
curl http://localhost:3000/api/storage/personas/optimist
```
- Should see tool_call for `update_persona_name`
- Should see confirmation in response
- GET request should show updated name

**What's implemented**:
- Write tool definitions and execution
- All CRUD operations for persona and test inputs

---

### Milestone 4: Minimal UI
**Goal**: Can chat with agent in browser (basic UI, no fancy panel yet)

**How to test**:
- Go to persona editor page
- See chat input at bottom
- Type message, see response appear
- Make a change, see it reflected in the editor

**What's implemented**:
- Chat input component
- Basic message display (can be simple list, not ephemeral panel yet)
- Streaming wired up

---

### Milestone 5: Full UI
**Goal**: Complete ephemeral panel experience

**How to test**:
- Send message, panel appears with streaming response
- Wait 5 seconds, panel auto-dismisses
- Click "Show output" to see history
- Clear conversation works

**What's implemented**:
- Ephemeral panel with auto-dismiss
- Panel state machine (HIDDEN/VISIBLE/PINNED)
- Clear conversation

---

## Implementation Plan

### Phase 0: Test Infrastructure (FIRST)
1. Create `tests/live-llm/persona-agent.test.ts` with test structure
2. Create test utilities (sendAgentMessage, createTestPersona, etc.)
3. Write failing tests for basic agent flow
4. Write failing tests for tool use scenarios
5. Write failing tests for streaming

### Phase 1: Data Model & Storage
1. Create turn types (`AgentTurn`, `UserTurn`, etc.) in `src/types`
2. Add `agentChatSessionId` to Persona type
3. Create agent session storage client and API routes

### Phase 2: Backend Agent Loop
1. Create tool definitions (Anthropic format)
2. Create tool executor (runs tools in-process)
3. Implement agentic loop with streaming
4. Create `/api/persona-agent/chat` endpoint
5. Create `/api/persona-agent/clear` endpoint
6. **Run tests - should pass**

### Phase 3: UI Integration
1. Create chat input bar (fixed bottom, full width)
2. Create agent output panel (overlay, shows turns)
3. Implement auto-dismiss behavior
4. Wire up streaming to panel
5. Add clear conversation functionality

### Phase 4: Polish
1. Improve tool call/result visualization
2. Error handling and retry
3. Loading states
4. Refine auto-dismiss timing

## Considerations

### Streaming with Tool Use

The Anthropic SDK streams content blocks. A response may contain multiple content blocks:
- `text` blocks stream character by character
- `tool_use` blocks arrive when complete

We need to handle the case where a single response contains `[text, tool_use, tool_use]` - this becomes multiple turns in our model.

### Converting Between Formats

We maintain a flat turn sequence for display, but need to convert to/from Claude's message format for API calls. This conversion happens server-side:
- On API call: turns → Claude messages
- On response: Claude content blocks → turns

### Concurrent Edits

If the user edits the persona directly (via the existing UI) while chatting, the agent's view may be stale. We accept this limitation - the agent reads fresh data before modifying.

### Model Selection

Use Claude Sonnet for the agent - it needs to understand user intent and use tools appropriately. Can make this configurable later.

## Open Questions

1. ~~Should tool use be shown in the UI?~~ Yes, all turns are shown
2. Should we allow the agent to run test inputs? (Future enhancement)
3. Should conversation history be limited? (Probably yes, last N turns)
4. Exact auto-dismiss timing? (Starting with 5 seconds)
5. Panel size/position? (Need to prototype)
