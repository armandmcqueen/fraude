import { PromptContext } from '@/types';

/**
 * Interface for retrieving system prompts.
 */
export interface PromptProvider {
  /**
   * Get the system prompt for a conversation context.
   */
  getSystemPrompt(context: PromptContext): Promise<string>;
}
