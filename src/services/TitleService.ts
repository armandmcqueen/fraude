import { APILLMClient } from './llm';
import { config } from '@/lib/config';
import { log } from '@/lib/logger';

/**
 * Service for generating conversation titles using LLM.
 * Runs client-side, calls server via APILLMClient.
 */
export class TitleService {
  private llmClient: APILLMClient;

  constructor(llmClient: APILLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Generate a concise, descriptive title for a conversation.
   */
  async generate(conversationId: string, userMessage: string): Promise<string> {
    const systemPrompt = `You generate short, descriptive titles for conversations.
Rules:
- Output ONLY the title, nothing else
- Maximum 50 characters
- No quotes or punctuation at the end
- Capture the main topic or intent
- Be specific but concise`;

    const userPrompt = `Generate a title for a conversation that starts with this message:\n\n${userMessage}`;

    try {
      const response = await this.llmClient.complete(
        conversationId,
        systemPrompt,
        userPrompt,
        { model: config.utilityModel, maxTokens: 50 }
      );

      // Clean up the title
      let title = response.trim();
      title = title.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
      title = title.replace(/[.!?]$/, ''); // Remove trailing punctuation

      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }

      return title || 'New conversation';
    } catch (error) {
      log.error('Failed to generate title:', error);
      // Fallback to simple truncation
      const firstLine = userMessage.split(/[.\n]/)[0].trim();
      if (firstLine.length <= 50) {
        return firstLine || 'New conversation';
      }
      return firstLine.substring(0, 47) + '...';
    }
  }
}
