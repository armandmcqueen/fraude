import { APILLMClient } from './llm';
import { config } from '@/lib/config';
import { log } from '@/lib/logger';

// Only generate summaries for responses above this length
export const SUMMARY_THRESHOLD = 500; // characters

/**
 * Service for generating message summaries using LLM.
 * Runs client-side, calls server via APILLMClient.
 */
export class SummaryService {
  private llmClient: APILLMClient;

  constructor(llmClient: APILLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Check if content should be summarized based on length.
   */
  shouldSummarize(content: string): boolean {
    return content.length >= SUMMARY_THRESHOLD;
  }

  /**
   * Generate a concise summary of an assistant message.
   * Returns null if summarization fails.
   */
  async generate(
    conversationId: string,
    content: string,
    personaName?: string,
    userMessage?: string
  ): Promise<string | null> {
    const systemPrompt = `You are a summarizer. Create a brief summary (2-4 sentences) of the following response. Focus on the key points and conclusions. Be concise. Output only the summary, nothing else.`;

    let userPrompt = '';

    // Include user message for context if provided
    if (userMessage) {
      userPrompt += `User's question: ${userMessage}\n\n`;
    }

    userPrompt += personaName
      ? `${personaName}'s response:\n${content}`
      : `Response:\n${content}`;

    try {
      const summary = await this.llmClient.complete(
        conversationId,
        systemPrompt,
        userPrompt,
        { model: config.utilityModel, maxTokens: 256 }
      );

      return summary.trim();
    } catch (error) {
      log.error('Failed to generate summary:', error);
      return null;
    }
  }
}
