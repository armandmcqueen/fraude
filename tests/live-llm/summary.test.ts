import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, getServerUrl, waitForServer } from './server-utils';
import { SummaryService, SUMMARY_THRESHOLD } from '@/services/SummaryService';
import { APILLMClient } from '@/services/llm/APILLMClient';

describe('SummaryService', () => {
  let llmClient: APILLMClient;
  let summaryService: SummaryService;

  beforeAll(async () => {
    await startServer();
    await waitForServer();

    const serverUrl = getServerUrl();
    llmClient = new APILLMClient({
      chatEndpoint: `${serverUrl}/api/chat`,
      completeEndpoint: `${serverUrl}/api/complete`,
    });
    summaryService = new SummaryService(llmClient);
  }, 120000);

  afterAll(async () => {
    await stopServer();
  });

  it('should correctly identify content that needs summarization', () => {
    const shortContent = 'This is a short response.';
    const longContent = 'A'.repeat(SUMMARY_THRESHOLD + 100);

    expect(summaryService.shouldSummarize(shortContent)).toBe(false);
    expect(summaryService.shouldSummarize(longContent)).toBe(true);
    expect(summaryService.shouldSummarize('A'.repeat(SUMMARY_THRESHOLD - 1))).toBe(false);
    expect(summaryService.shouldSummarize('A'.repeat(SUMMARY_THRESHOLD))).toBe(true);
  });

  it('should generate a concise summary of a long response', async () => {
    const conversationId = `test-summary-${Date.now()}`;

    // A long, detailed response that needs summarizing
    const longContent = `
Photosynthesis is one of the most important biological processes on Earth. It is the process by which plants, algae, and certain bacteria convert light energy, usually from the sun, into chemical energy stored in glucose. This process occurs primarily in the chloroplasts of plant cells, where chlorophyll, the green pigment, absorbs light energy.

The process can be divided into two main stages: the light-dependent reactions and the light-independent reactions (also known as the Calvin cycle). During the light-dependent reactions, which take place in the thylakoid membranes, light energy is captured and used to produce ATP and NADPH. Water molecules are split, releasing oxygen as a byproduct.

In the Calvin cycle, which occurs in the stroma of the chloroplast, the ATP and NADPH produced in the first stage are used to convert carbon dioxide into glucose. This glucose can then be used by the plant for energy or converted into other organic compounds like starch for storage.

The overall equation for photosynthesis is: 6CO2 + 6H2O + light energy → C6H12O6 + 6O2. This process is essential for life on Earth as it produces the oxygen we breathe and forms the base of most food chains.
    `.trim();

    expect(summaryService.shouldSummarize(longContent)).toBe(true);

    const summary = await summaryService.generate(conversationId, longContent);

    console.log('Original length:', longContent.length);
    console.log('Summary:', summary);
    console.log('Summary length:', summary?.length);

    expect(summary).not.toBeNull();
    expect(summary!.length).toBeGreaterThan(0);
    expect(summary!.length).toBeLessThan(longContent.length);

    // Summary should be significantly shorter (at least 50% reduction)
    expect(summary!.length).toBeLessThan(longContent.length * 0.5);

    // Summary should mention key concepts
    const lowerSummary = summary!.toLowerCase();
    expect(
      lowerSummary.includes('photosynthesis') ||
      lowerSummary.includes('plant') ||
      lowerSummary.includes('light') ||
      lowerSummary.includes('glucose') ||
      lowerSummary.includes('oxygen')
    ).toBe(true);
  }, 30000);

  it('should generate summary with persona name context', async () => {
    const conversationId = `test-summary-persona-${Date.now()}`;

    const longContent = `
As an optimist, I see tremendous potential in artificial intelligence. While there are certainly challenges to address, the benefits far outweigh the risks. AI has already revolutionized healthcare diagnostics, making early disease detection more accurate than ever before. In education, personalized learning powered by AI is helping students learn at their own pace. The technology is also making significant strides in climate science, helping us model and predict environmental changes with unprecedented accuracy. Rather than fearing AI, we should embrace it as a tool that can help solve humanity's greatest challenges.
    `.trim();

    const summary = await summaryService.generate(
      conversationId,
      longContent,
      'The Optimist'
    );

    console.log('Persona summary:', summary);

    expect(summary).not.toBeNull();
    expect(summary!.length).toBeGreaterThan(0);
    expect(summary!.length).toBeLessThan(longContent.length);
  }, 30000);

  it('should handle very long content gracefully', async () => {
    const conversationId = `test-summary-long-${Date.now()}`;

    // Create a very long response (simulating a detailed technical explanation)
    const paragraph = `
This is a detailed technical paragraph that explains a complex concept in depth.
It contains multiple sentences and covers various aspects of the topic at hand.
The explanation includes examples, analogies, and technical details that help
illustrate the main points being made. Each paragraph builds upon the previous
one to create a comprehensive understanding of the subject matter.
    `.trim();

    const longContent = Array(10).fill(paragraph).join('\n\n');

    console.log('Very long content length:', longContent.length);
    expect(longContent.length).toBeGreaterThan(3000);

    const summary = await summaryService.generate(conversationId, longContent);

    console.log('Summary of very long content:', summary);
    console.log('Summary length:', summary?.length);

    expect(summary).not.toBeNull();
    // Summary should still be concise even for very long content
    expect(summary!.length).toBeLessThan(500);
  }, 30000);
});
