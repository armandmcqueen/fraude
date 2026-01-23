import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

/**
 * Utility LLM service for quick, non-streaming tasks like generating titles.
 * Uses a fast, cost-effective model (Haiku 4.5) for these operations.
 */
export class UtilityLLMService {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || config.anthropicApiKey,
    });
  }

  /**
   * Generate a concise, descriptive title for a conversation based on the user's first message.
   */
  async generateConversationTitle(userMessage: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: config.utilityModel,
        max_tokens: 50,
        system: `You generate short, descriptive titles for conversations.
Rules:
- Output ONLY the title, nothing else
- Maximum 50 characters
- No quotes or punctuation at the end
- Capture the main topic or intent
- Be specific but concise`,
        messages: [
          {
            role: 'user',
            content: `Generate a title for a conversation that starts with this message:\n\n${userMessage}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Clean up the title - remove quotes, trim, ensure length
        let title = content.text.trim();
        title = title.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
        title = title.replace(/[.!?]$/, ''); // Remove trailing punctuation

        if (title.length > 50) {
          title = title.substring(0, 47) + '...';
        }

        return title || 'New conversation';
      }

      return 'New conversation';
    } catch (error) {
      console.error('Failed to generate title:', error);
      // Fallback to simple truncation
      const firstLine = userMessage.split(/[.\n]/)[0].trim();
      if (firstLine.length <= 50) {
        return firstLine || 'New conversation';
      }
      return firstLine.substring(0, 47) + '...';
    }
  }
}
