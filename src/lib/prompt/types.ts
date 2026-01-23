import { PromptContext } from '@/types';

export interface PromptProvider {
  getSystemPrompt(context: PromptContext): Promise<string>;
}
