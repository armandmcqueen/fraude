// Base data directory - can be overridden via TEST_DATA_DIR for parallel test isolation
const baseDataDir = process.env.TEST_DATA_DIR || './data';

export const config = {
  // LLM - API key hardcoded for now (single user prototype)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || 'YOUR_API_KEY_HERE',
  defaultModel: 'claude-sonnet-4-5-20250929',
  utilityModel: 'claude-haiku-4-5-20251001', // Fast model for utility tasks (title generation, etc.)

  // Gemini (for image generation)
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  defaultImageModel: 'gemini-3-pro-image-preview',

  // Storage - all paths relative to baseDataDir for test isolation
  dataDir: `${baseDataDir}/conversations`,
  personasDir: `${baseDataDir}/personas`,
  resourcesDir: `${baseDataDir}/resources`,
  testInputsDir: `${baseDataDir}/test-inputs`,
  settingsFile: `${baseDataDir}/settings.json`,
  agentSessionsDir: `${baseDataDir}/agent-sessions`,
  llmCallsDir: `${baseDataDir}/llm-calls`,
  imagesDir: `${baseDataDir}/images`,
  slidegenEvalDir: `${baseDataDir}/slidegen-eval`,

  // UI
  maxMessageLength: 100000,
} as const;

export const availableModels = [
  // Latest models (Claude 4.5 family)
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5' },
  // Legacy models
  { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude Sonnet 3.7' },
  { id: 'claude-3-haiku-20240307', name: 'Claude Haiku 3' },
] as const;

export const availableImageModels = [
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro (Preview)' },
] as const;
