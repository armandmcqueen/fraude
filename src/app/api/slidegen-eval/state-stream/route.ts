import { stateEventEmitter, StateEvent } from '@/services/slidegen-eval';
import {
  JsonEvalConfigStorageProvider,
  JsonEvalTestCaseStorageProvider,
  JsonEvalResultStorageProvider,
} from '@/lib/storage';
import { log } from '@/lib/logger';
import { PromptEnhancerConfig } from '@/types/slidegen-eval';

const configStorage = new JsonEvalConfigStorageProvider();
const testCaseStorage = new JsonEvalTestCaseStorageProvider();
const resultStorage = new JsonEvalResultStorageProvider();

// Default system prompt - same as PROMPT_ENHANCER_SYSTEM in image-gen route
const DEFAULT_SYSTEM_PROMPT = `You are an expert at creating prompts for image generation models. Your task is to take raw content (ideas, text, concepts) and transform them into effective prompts for generating text-centric presentation slides.

IMPORTANT: The generated image should BE the slide itself - the entire image is the slide. Do NOT describe a picture that contains a slide, or a slide on a screen, or a presentation setup. The image IS the slide content directly.

The slides should be TEXT-CENTRIC. The text on the slide should communicate the core idea - someone should be able to understand the main point just by reading the slide.

A good slide prompt should include:
1. A clear title or headline that captures the main idea (in quotes)
2. Optionally 2-4 bullet points or key phrases that support the main idea (each in quotes)
3. An attractive background (gradient, pattern, or subtle imagery)
4. Clear typography

Guidelines:
- Extract the CORE MESSAGE from the input and express it as text on the slide
- Specify exact text in quotes: "Main Title Here" and supporting text like "• First point" "• Second point"
- Keep text concise - distill ideas into punchy, memorable phrases
- Text does NOT need to be large
- Balance visual interest with readability

TEXT STYLING: If you want specific text styling, you must be explicit about WHICH words get WHAT styling. Use markdown within the quoted text to communicate styling:
- **bold text** for emphasis
- *italic text* for subtle emphasis
- Use descriptions like: the word "Innovation" in bold, "key metrics" in italic
- Or: "**Innovation** drives *everything*" to show exact styling

Output ONLY the image generation prompt, nothing else. No explanations, no preamble.`;

/**
 * Get or create the default config.
 * Seeds with the real PROMPT_ENHANCER_SYSTEM if no config exists.
 */
async function getOrCreateConfig(): Promise<PromptEnhancerConfig> {
  const existing = await configStorage.getConfig();
  if (existing) {
    return existing;
  }

  // Seed default config
  const defaultConfig: PromptEnhancerConfig = {
    id: 'default',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    version: 1,
    versionName: 'v1',
    updatedAt: new Date(),
  };

  await configStorage.saveConfig(defaultConfig);
  log.info('[state-stream] Seeded default config with PROMPT_ENHANCER_SYSTEM');

  return defaultConfig;
}

/**
 * SSE endpoint for real-time state synchronization.
 *
 * Clients connect to this endpoint and receive events whenever state changes:
 * - config_updated
 * - test_case_added
 * - test_case_updated
 * - test_case_deleted
 * - test_result_updated
 * - changelog_entry_added
 *
 * On initial connection, the client receives:
 * 1. A 'connected' event with their client ID
 * 2. An 'initial_state' event with the current config, test cases, and results
 */
export async function GET() {
  const encoder = new TextEncoder();

  // Load initial state (seeds default config if none exists)
  const [config, testCaseSummaries, results] = await Promise.all([
    getOrCreateConfig(),
    testCaseStorage.listTestCases(),
    resultStorage.listResults(),
  ]);

  // Load full test cases (summaries don't have full inputText)
  const testCases = await Promise.all(
    testCaseSummaries.map((summary) => testCaseStorage.getTestCase(summary.id))
  );

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: StateEvent | { type: 'initial_state'; data: unknown }) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch (error) {
          log.error('[state-stream] Error sending event:', error);
        }
      };

      // Subscribe to state events
      const { clientId, unsubscribe } = stateEventEmitter.subscribe((event) => {
        sendEvent(event);
      });

      log.info(`[state-stream] Client ${clientId} connected. Total clients: ${stateEventEmitter.getSubscriberCount()}`);

      // Send initial state after connected event
      sendEvent({
        type: 'initial_state',
        data: {
          config,
          testCases: testCases.filter(Boolean), // Filter out any nulls
          results,
        },
      });

      // Handle client disconnect
      // Note: We can't directly detect disconnect in this pattern,
      // but the subscriber will be removed when write fails
      const cleanup = () => {
        unsubscribe();
        log.info(`[state-stream] Client ${clientId} disconnected. Total clients: ${stateEventEmitter.getSubscriberCount()}`);
      };

      // Store cleanup function so it can be called on abort
      // The subscriber callback will fail when the connection closes,
      // triggering removal from the emitter
      controller.enqueue(encoder.encode(`: keepalive\n\n`));

      // Set up periodic keepalive to detect disconnected clients
      const keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          // Client disconnected
          clearInterval(keepaliveInterval);
          cleanup();
        }
      }, 30000); // Send keepalive every 30 seconds

      // Clean up on abort signal if available
      // @ts-expect-error - signal may not be available in all contexts
      if (controller.signal) {
        // @ts-expect-error - signal may not be available in all contexts
        controller.signal.addEventListener('abort', () => {
          clearInterval(keepaliveInterval);
          cleanup();
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
