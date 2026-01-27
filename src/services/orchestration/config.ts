/**
 * Configuration for multi-persona conversation behavior.
 */
export interface ConversationConfig {
  /**
   * How personas execute:
   * - 'sequential': One at a time, in order
   * - 'parallel': All at once, responses stream simultaneously
   */
  executionMode: 'sequential' | 'parallel';

  /**
   * What context each persona sees:
   * - 'shared': Personas see each other's responses (sequential only)
   * - 'isolated': Personas only see user messages, not other personas
   */
  contextMode: 'shared' | 'isolated';
}

export const DEFAULT_CONFIG: ConversationConfig = {
  executionMode: 'sequential',
  contextMode: 'shared',
};

/**
 * Preset configurations for easy switching.
 */
export const CONFIG_PRESETS: Record<string, ConversationConfig> = {
  'Sequential (shared context)': {
    executionMode: 'sequential',
    contextMode: 'shared',
  },
  'Sequential (isolated)': {
    executionMode: 'sequential',
    contextMode: 'isolated',
  },
  'Parallel (isolated)': {
    executionMode: 'parallel',
    contextMode: 'isolated',
  },
};
