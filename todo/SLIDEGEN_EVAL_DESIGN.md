# Slidegen Eval Suite Design

## Problem Statement

We need a tool to iterate on the Prompt Enhancer system prompt. The Prompt Enhancer takes raw slide content and transforms it into an image generation prompt, which is then fed to Gemini.

The current persona editor has sync issues:
1. UI doesn't update frequently enough when agent makes changes
2. Human edits in UI aren't visible to agent immediately
3. Tests run by agent are isolated from UI test display

## Goals

1. Edit the Prompt Enhancer system prompt (directly or via agent)
2. Manage test cases (input text that gets run through the pipeline)
3. Run tests: Input → Prompt Enhancer (Claude) → Image Generator (Gemini)
4. **UI and agent always see the same state** - changes from either side immediately visible to both
5. Agent can edit prompt, manage tests, run tests, have conversations

## Design Principles

**No shared code with Persona Editor.** While this feature is similar to the persona editor, we should not extract shared components or utilities. The two features may diverge in unexpected ways as we develop, and premature abstraction would create coupling that makes both harder to change. Copy patterns, not code.

## Data Models

```typescript
// The system prompt being edited/tested
interface PromptEnhancerConfig {
  id: string;              // 'default' for now, extensible later
  systemPrompt: string;
  version: number;         // Incremented on every change (for sync)
  updatedAt: Date;
}

// A test case - raw slide content to test with
interface EvalTestCase {
  id: string;
  name: string;            // Short descriptive name
  inputText: string;       // Raw slide content
  createdAt: Date;
  updatedAt: Date;
}

// Result of running a test case
interface EvalTestResult {
  id: string;
  testCaseId: string;
  configVersion: number;   // Which config version produced this
  enhancedPrompt: string;  // Output from Prompt Enhancer (Claude)
  generatedImageId?: string;  // Reference to stored image
  imageError?: string;     // Error if image generation failed
  status: 'pending' | 'enhancing' | 'generating_image' | 'complete' | 'error';
  runStartedAt: Date;
  runCompletedAt?: Date;
}
```

## Sync Architecture

**Core Insight**: Server is single source of truth. All changes emit SSE events to UI.

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│   UI        │ ──HTTP mutations─► │   Server    │ ──stores──────────►│ JSON Files  │
│   (React)   │ ◄──SSE events───── │             │                    │             │
└─────────────┘                    └─────────────┘                    └─────────────┘
                                          ▲
                                          │
┌─────────────┐                           │
│   Agent     │ ──tool calls─────────────►│
│   Tools     │   (mutate server state)
└─────────────┘
```

### SSE Events

When anything changes on the server, it emits an event:

- `config_updated` - System prompt changed
- `test_case_added` - New test case created
- `test_case_updated` - Test case modified
- `test_case_deleted` - Test case removed
- `test_result_updated` - Test progress or completion

The UI subscribes to these events and updates immediately.

### Why This Solves UI Seeing Agent Changes

1. **Agent modifies prompt** → Server updates storage → Emits `config_updated` → UI sees new prompt immediately
2. **Agent runs test** → Server executes test → Emits progress events → UI shows progress in real-time

Both UI and agent mutations go through the server, which broadcasts changes via SSE.

### How Agent Knows About UI Changes: Changelog

The SSE approach solves UI seeing agent changes, but the agent also needs to know when humans made changes. Solution: **Changelog injected into agent context**.

```typescript
// New data model
interface ChangelogEntry {
  id: string;
  timestamp: Date;
  source: 'ui' | 'agent';
  action: 'config_updated' | 'test_case_created' | 'test_case_updated' | 'test_case_deleted' | 'test_run_started' | 'test_run_completed';
  summary: string;  // Human-readable: "System prompt updated", "Test case 'Marketing' created"
  details?: Record<string, unknown>;  // Optional structured data
}
```

**How it works:**
1. Every mutation (UI or agent) appends to the changelog
2. Agent chat stores `lastSeenChangelogId` in the session
3. On each agent turn, inject recent changelog entries into system prompt:
   ```
   [RECENT CHANGES SINCE YOUR LAST TURN]
   - 2 minutes ago (UI): System prompt updated
   - 1 minute ago (UI): Test case "Marketing Slide" input text modified
   - 30 seconds ago (UI): Test run started for "Marketing Slide"
   ```
4. Agent can see what human did and respond appropriately

**Storage:** `data/slidegen-eval/changelog.json` - append-only, can be truncated periodically.

## File Structure

```
src/
├── app/
│   ├── slidegen-eval/
│   │   └── page.tsx                     # Main page
│   └── api/slidegen-eval/
│       ├── config/route.ts              # GET/PUT config
│       ├── test-cases/
│       │   ├── route.ts                 # GET all, POST create
│       │   └── [id]/route.ts            # GET/PUT/DELETE single
│       ├── test-results/route.ts        # GET all results
│       ├── run-test/route.ts            # POST - run single test
│       ├── run-all-tests/route.ts       # POST - run all tests
│       ├── state-stream/route.ts        # SSE endpoint for real-time sync
│       └── agent/
│           ├── chat/route.ts            # Agent chat (SSE streaming)
│           ├── clear/route.ts           # Clear agent history
│           └── history/route.ts         # Get agent history
│
├── components/slidegen-eval/
│   ├── SlidegenEvalView.tsx             # Main layout orchestrator
│   ├── PromptEditor.tsx                 # System prompt textarea
│   ├── TestCaseList.tsx                 # List of test cases
│   ├── TestCaseItem.tsx                 # Single test case with result preview
│   ├── TestResultDisplay.tsx            # Full result: enhanced prompt + image
│   └── AgentChatPanel.tsx               # Agent chat (similar to persona editor)
│
├── hooks/
│   ├── useSlidegenEvalState.ts          # SSE-based state management
│   └── useSlidegenEvalAgent.ts          # Agent chat hook
│
├── services/slidegen-eval/
│   ├── TestRunner.ts                    # Shared test execution service
│   └── StateEventEmitter.ts             # Server-side event broadcasting
│
├── lib/storage/
│   ├── json-eval-config-storage.ts      # Config persistence
│   ├── json-eval-testcase-storage.ts    # Test case persistence
│   ├── json-eval-result-storage.ts      # Test result persistence
│   └── json-eval-changelog-storage.ts   # Changelog for agent awareness
│
└── types/slidegen-eval.ts               # Type definitions
```

## Agent Tools

### Read Tools
- `get_config` - Get current system prompt
- `list_test_cases` - List all test cases with names and input text
- `get_test_result` - Get result for a specific test case

### Write Tools
- `update_system_prompt` - Replace the system prompt
- `create_test_case` - Create a new test case
- `update_test_case` - Modify an existing test case
- `delete_test_case` - Delete a test case

### Execution Tools
- `run_test` - Run a single test case (results appear in UI via SSE)
- `run_all_tests` - Run all test cases

### UI Control
- `keep_output_visible` - Prevent agent panel auto-dismiss

## Test Execution Flow

The `TestRunner` service is used by both UI and agent:

```
1. Create pending result
   └─► Emit test_result_updated (status: pending)

2. Call Claude with system prompt + input
   └─► Get enhanced prompt
   └─► Emit test_result_updated (status: generating_image, enhancedPrompt: "...")

3. Call Gemini with enhanced prompt
   └─► Get generated image
   └─► Save image to storage
   └─► Emit test_result_updated (status: complete, generatedImageId: "...")
```

UI shows real-time progress via SSE events.

## UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Slidegen Eval                                    [● Connected]  │
├────────────────────────────┬─────────────────────────────────────┤
│                            │                                     │
│   System Prompt            │   Test Cases                        │
│   ┌──────────────────┐     │   ┌─────────────────────────────┐   │
│   │                  │     │   │ ▸ Marketing Slide           │   │
│   │  [editable       │     │   │   "Q3 revenue grew 40%..."  │   │
│   │   textarea]      │     │   │   Status: ✓ Complete        │   │
│   │                  │     │   │   [Run] [Edit] [Delete]     │   │
│   │                  │     │   ├─────────────────────────────┤   │
│   │                  │     │   │ ▸ Tech Introduction         │   │
│   │                  │     │   │   "AI is transforming..."   │   │
│   │                  │     │   │   Status: ⏳ Generating...  │   │
│   │                  │     │   │   [Run] [Edit] [Delete]     │   │
│   │                  │     │   ├─────────────────────────────┤   │
│   │                  │     │   │ [+ Add Test Case]           │   │
│   └──────────────────┘     │   └─────────────────────────────┘   │
│                            │                                     │
├────────────────────────────┴─────────────────────────────────────┤
│   Agent Chat (collapsible)                                       │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │ Agent: I've updated the prompt to be more specific...    │   │
│   │ Agent: Running all tests now...                          │   │
│   └──────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│   [Message input...]                                             │
└──────────────────────────────────────────────────────────────────┘
```

### Expanded Test Result View

When clicking on a test case, show full details:
- Input text
- Enhanced prompt (from Claude)
- Generated image (from Gemini)
- Config version used
- Timing information

## State Management Hook

```typescript
// hooks/useSlidegenEvalState.ts
function useSlidegenEvalState() {
  // State
  const [config, setConfig] = useState<PromptEnhancerConfig | null>(null);
  const [testCases, setTestCases] = useState<EvalTestCase[]>([]);
  const [testResults, setTestResults] = useState<Map<string, EvalTestResult>>();
  const [isConnected, setIsConnected] = useState(false);

  // SSE subscription - updates state when events arrive
  useEffect(() => {
    const eventSource = new EventSource('/api/slidegen-eval/state-stream');
    eventSource.addEventListener('config_updated', (e) => { ... });
    eventSource.addEventListener('test_result_updated', (e) => { ... });
    // etc.
    return () => eventSource.close();
  }, []);

  // Actions - send to server, state updates via SSE
  const updateConfig = async (systemPrompt: string) => { ... };
  const createTestCase = async (name: string, inputText: string) => { ... };
  const runTest = async (testCaseId: string) => { ... };
  // etc.

  return { config, testCases, testResults, isConnected, updateConfig, ... };
}
```

## Comparison with Persona Editor

| Aspect | Persona Editor | Slidegen Eval |
|--------|---------------|---------------|
| State location | Client (hook state) | Server (JSON files) |
| Sync mechanism | Refresh after agent finishes | SSE real-time events |
| Test results | In-memory Map | Persisted to disk |
| Test execution | Separate UI/agent paths | Shared TestRunner |
| Agent visibility | Stale until tool call | Always current |

## Testing Strategy

Tests are written and run as part of development, not after. Each milestone includes required tests.

### Test Categories

1. **Unit Tests** (`tests/unit/slidegen-eval/`)
   - Storage providers (config, test cases, results, changelog)
   - StateEventEmitter
   - TestRunner (with mocked LLM calls)

2. **API Integration Tests** (`tests/integration/slidegen-eval/`)
   - Config CRUD endpoints
   - Test case CRUD endpoints
   - SSE state-stream event emission
   - Changelog recording

3. **Agent Tool Tests** (`tests/integration/slidegen-eval/agent/`)
   - Each tool executes correctly
   - Tools emit proper changelog entries
   - Agent sees changelog in context

4. **E2E Tests** (manual verification per milestone)
   - Documented verification steps
   - Must pass before moving to next milestone

### Test Utilities

- Mock LLM client for unit tests (no real API calls)
- Test data factories for creating test fixtures
- Isolated test storage directory (use `TEST_DATA_DIR` pattern from existing tests)

## Implementation Milestones

Development proceeds in milestones. Each milestone has:
- Clear deliverables
- Required tests
- Verification checklist (must pass before proceeding)

---

### Milestone 1: Storage Layer

**Goal:** Persist config, test cases, results, and changelog to disk.

**Deliverables:**
- `types/slidegen-eval.ts` - All type definitions
- `lib/storage/json-eval-config-storage.ts`
- `lib/storage/json-eval-testcase-storage.ts`
- `lib/storage/json-eval-result-storage.ts`
- `lib/storage/json-eval-changelog-storage.ts`

**Tests:**
- Unit tests for each storage provider
- CRUD operations work correctly
- Changelog appends correctly

**Verification:**
- [ ] `npm test` passes for new storage tests
- [ ] Can manually create/read/update/delete via storage classes
- [ ] Data persists in `data/slidegen-eval/` directory

---

### Milestone 2: SSE Events Infrastructure

**Goal:** Real-time event broadcasting from server to UI.

**Deliverables:**
- `services/slidegen-eval/StateEventEmitter.ts`
- `api/slidegen-eval/state-stream/route.ts` (SSE endpoint)

**Tests:**
- Unit test: EventEmitter subscribe/emit/unsubscribe
- Integration test: SSE endpoint sends events

**Verification:**
- [ ] Can connect to `/api/slidegen-eval/state-stream` with curl/browser
- [ ] Events emitted by StateEventEmitter arrive at SSE client
- [ ] Multiple clients receive same events

---

### Milestone 3: Config & Test Case APIs

**Goal:** CRUD endpoints for config and test cases, with SSE events.

**Deliverables:**
- `api/slidegen-eval/config/route.ts` (GET/PUT)
- `api/slidegen-eval/test-cases/route.ts` (GET/POST)
- `api/slidegen-eval/test-cases/[id]/route.ts` (GET/PUT/DELETE)

**Tests:**
- Integration tests for each endpoint
- Verify SSE events emitted on mutations
- Verify changelog entries created

**Verification:**
- [ ] Can CRUD config via API (curl/Postman)
- [ ] Can CRUD test cases via API
- [ ] SSE stream receives events on mutations
- [ ] Changelog contains entries for all mutations

---

### Milestone 4: Test Execution

**Goal:** Run tests through Prompt Enhancer → Image Generator pipeline.

**Deliverables:**
- `services/slidegen-eval/TestRunner.ts`
- `api/slidegen-eval/run-test/route.ts`
- `api/slidegen-eval/run-all-tests/route.ts`
- `api/slidegen-eval/test-results/route.ts`

**Tests:**
- Unit test: TestRunner with mocked LLM (verify flow)
- Integration test: API endpoints trigger test runs
- Verify SSE progress events

**Verification:**
- [ ] Can run single test via API, see progress via SSE
- [ ] Can run all tests via API
- [ ] Results stored and retrievable
- [ ] Generated images saved to storage

---

### Milestone 5: Basic UI (No Agent)

**Goal:** Functional UI for editing config, managing test cases, running tests.

**Deliverables:**
- `hooks/useSlidegenEvalState.ts` (SSE subscription)
- `app/slidegen-eval/page.tsx`
- `components/slidegen-eval/SlidegenEvalView.tsx`
- `components/slidegen-eval/PromptEditor.tsx`
- `components/slidegen-eval/TestCaseList.tsx`
- `components/slidegen-eval/TestCaseItem.tsx`
- Sidebar navigation link

**Tests:**
- Hook unit tests (state updates on SSE events)

**Verification:**
- [ ] Can navigate to `/slidegen-eval`
- [ ] Can edit system prompt, see "Saved" confirmation
- [ ] Can add/edit/delete test cases
- [ ] Can run tests, see real-time progress
- [ ] Can view test results (enhanced prompt + image)
- [ ] Refresh page - state persists

---

### Milestone 6: Agent Integration

**Goal:** Agent can chat, modify config, manage tests, run tests.

**Deliverables:**
- `api/slidegen-eval/agent/chat/route.ts`
- `api/slidegen-eval/agent/chat/tools.ts`
- `api/slidegen-eval/agent/history/route.ts`
- `api/slidegen-eval/agent/clear/route.ts`
- `hooks/useSlidegenEvalAgent.ts`
- `components/slidegen-eval/AgentChatPanel.tsx`
- Changelog injection into agent context

**Tests:**
- Integration tests for each agent tool
- Test that changelog is injected into agent context
- Test that agent tool calls create changelog entries

**Verification:**
- [ ] Can chat with agent
- [ ] Agent can read current config and test cases
- [ ] Agent can modify config (UI updates immediately via SSE)
- [ ] Agent can create/modify/delete test cases (UI updates)
- [ ] Agent can run tests (results appear in UI)
- [ ] Make UI change → agent's next response mentions seeing the change
- [ ] Chat history persists across page refresh

---

### Milestone 7: Polish & Migration

**Goal:** Production-ready, integrated with image-gen.

**Deliverables:**
- SSE reconnection handling
- Loading/error states throughout UI
- Image-gen route reads config from eval storage
- Default config seeded from current `PROMPT_ENHANCER_SYSTEM`

**Verification:**
- [ ] Disconnect/reconnect SSE - UI recovers gracefully
- [ ] Error states shown appropriately
- [ ] Image-gen page uses config from eval storage
- [ ] Full workflow: edit prompt in eval → generate image in image-gen → see updated behavior

## Open Questions

1. Should test results be persisted permanently or cleared periodically?
2. Should we support multiple config versions (A/B testing prompts)? (Defer to later)
3. How to handle concurrent test runs (queue vs parallel)? (Suggest: parallel with UI showing all progress)
4. Should the agent be able to see generated images or just results metadata? (Suggest: metadata + image IDs, can view in UI)

## Data Directory Structure

```
data/slidegen-eval/
├── config.json           # PromptEnhancerConfig
├── test-cases.json       # Array of EvalTestCase
├── test-results.json     # Array of EvalTestResult
├── changelog.json        # Array of ChangelogEntry
└── agent-sessions/
    └── {sessionId}.json  # Agent chat sessions
```

## Agent System Prompt

The eval agent needs clear instructions about its role:

```
You are an assistant helping to iterate on a Prompt Enhancer system prompt.
The Prompt Enhancer takes raw slide content and transforms it into an image
generation prompt for creating presentation slides.

You can:
- Read and modify the system prompt
- Create, edit, and delete test cases
- Run tests to see how the prompt performs
- Have conversations about prompt engineering strategies

When you make changes, they are immediately visible in the UI. When the user
makes changes in the UI, you'll see them in the [RECENT CHANGES] section.

Test results include the enhanced prompt (your system prompt's output) and
the generated image. Focus on whether the enhanced prompts produce good
slide imagery.
```

## Initial Seed Data

On first load (no config.json exists):
1. Seed config with current `PROMPT_ENHANCER_SYSTEM` from `src/app/api/image-gen/route.ts`
2. Optionally seed 2-3 example test cases:
   - "Q3 revenue grew 40% year-over-year, driven by enterprise adoption"
   - "Three pillars of our strategy: Innovation, Scale, Trust"
   - "AI is transforming healthcare through predictive analytics"

## Migration

The current `PROMPT_ENHANCER_SYSTEM` constant in `src/app/api/image-gen/route.ts` will:
1. Become the default value when no config exists
2. The image-gen route will read from eval config storage
3. Fallback to hardcoded default if storage empty
