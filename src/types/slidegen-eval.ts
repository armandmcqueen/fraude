// =============================================================================
// Slidegen Eval Types
// =============================================================================

/**
 * The system prompt configuration being edited/tested.
 * Currently supports a single config ('default'), extensible to multiple later.
 */
export interface PromptEnhancerConfig {
  id: string;              // 'default' for now, extensible later
  systemPrompt: string;
  version: number;         // Incremented on every change (for sync)
  updatedAt: Date;
}

/**
 * A test case - raw slide content to test with the Prompt Enhancer.
 */
export interface EvalTestCase {
  id: string;
  name: string;            // Short descriptive name
  inputText: string;       // Raw slide content
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Summary for list view (without full input text).
 */
export interface EvalTestCaseSummary {
  id: string;
  name: string;
  inputTextPreview: string;  // Truncated preview of input text
}

/**
 * Result of running a test case through the pipeline.
 */
export interface EvalTestResult {
  id: string;
  testCaseId: string;
  configVersion: number;   // Which config version produced this
  enhancedPrompt: string;  // Output from Prompt Enhancer (Claude)
  generatedImageId?: string;  // Reference to stored image
  imageError?: string;     // Error if image generation failed
  status: EvalTestResultStatus;
  runStartedAt: Date;
  runCompletedAt?: Date;
}

export type EvalTestResultStatus =
  | 'pending'
  | 'enhancing'
  | 'generating_image'
  | 'complete'
  | 'error';

/**
 * Changelog entry for tracking mutations.
 * Used to inform the agent about UI changes.
 */
export interface ChangelogEntry {
  id: string;
  timestamp: Date;
  source: 'ui' | 'agent';
  action: ChangelogAction;
  summary: string;  // Human-readable: "System prompt updated", "Test case 'Marketing' created"
  details?: Record<string, unknown>;  // Optional structured data
}

export type ChangelogAction =
  | 'config_updated'
  | 'test_case_created'
  | 'test_case_updated'
  | 'test_case_deleted'
  | 'test_run_started'
  | 'test_run_completed';

// =============================================================================
// Agent Session Types (specific to slidegen-eval agent)
// =============================================================================

/**
 * Agent chat session for the slidegen eval agent.
 */
export interface SlidegenEvalAgentSession {
  id: string;
  turns: SlidegenEvalAgentTurn[];
  lastSeenChangelogId?: string;  // For injecting recent changes
  createdAt: Date;
  updatedAt: Date;
}

// Reuse turn types pattern from persona editor
export type SlidegenEvalAgentTurn =
  | SlidegenEvalUserTurn
  | SlidegenEvalAssistantTextTurn
  | SlidegenEvalToolCallTurn
  | SlidegenEvalToolResultTurn;

export interface SlidegenEvalUserTurn {
  type: 'user';
  id: string;
  content: string;
  createdAt: Date;
}

export interface SlidegenEvalAssistantTextTurn {
  type: 'assistant_text';
  id: string;
  content: string;
  createdAt: Date;
}

export interface SlidegenEvalToolCallTurn {
  type: 'tool_call';
  id: string;
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  createdAt: Date;
}

export interface SlidegenEvalToolResultTurn {
  type: 'tool_result';
  id: string;
  toolUseId: string;
  output: string;
  isError?: boolean;
  createdAt: Date;
}

// =============================================================================
// Storage Provider Interfaces
// =============================================================================

export interface EvalConfigStorageProvider {
  getConfig(): Promise<PromptEnhancerConfig | null>;
  saveConfig(config: PromptEnhancerConfig): Promise<void>;
}

export interface EvalTestCaseStorageProvider {
  listTestCases(): Promise<EvalTestCaseSummary[]>;
  getTestCase(id: string): Promise<EvalTestCase | null>;
  createTestCase(testCase: EvalTestCase): Promise<void>;
  updateTestCase(testCase: EvalTestCase): Promise<void>;
  deleteTestCase(id: string): Promise<void>;
}

export interface EvalResultStorageProvider {
  listResults(): Promise<EvalTestResult[]>;
  getResult(id: string): Promise<EvalTestResult | null>;
  getResultByTestCaseId(testCaseId: string): Promise<EvalTestResult | null>;
  saveResult(result: EvalTestResult): Promise<void>;
  deleteResultsForTestCase(testCaseId: string): Promise<void>;
}

export interface EvalChangelogStorageProvider {
  getEntries(sinceId?: string): Promise<ChangelogEntry[]>;
  appendEntry(entry: ChangelogEntry): Promise<void>;
  getLatestId(): Promise<string | null>;
  truncate(keepCount: number): Promise<void>;
}

export interface SlidegenEvalAgentSessionStorageProvider {
  getSession(id: string): Promise<SlidegenEvalAgentSession | null>;
  saveSession(session: SlidegenEvalAgentSession): Promise<void>;
  deleteSession(id: string): Promise<void>;
}
