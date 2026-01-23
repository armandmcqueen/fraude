import { PromptContext } from '@/types';
import { PromptProvider } from './types';

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. You provide clear, accurate, and thoughtful responses. When you don't know something, you say so. When asked to help with code, you write clean, well-structured code with appropriate comments.`;

export class DefaultPromptProvider implements PromptProvider {
  async getSystemPrompt(_context: PromptContext): Promise<string> {
    // Future: could customize based on context
    return DEFAULT_SYSTEM_PROMPT;
  }
}
