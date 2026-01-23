export const config = {
  // LLM - API key hardcoded for now (single user prototype)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || 'YOUR_API_KEY_HERE',
  defaultModel: 'claude-sonnet-4-5-20250929',

  // Storage
  dataDir: './data/conversations',

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
