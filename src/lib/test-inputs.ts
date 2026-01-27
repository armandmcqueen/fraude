/**
 * Quick test inputs for development.
 * Type a slash command (e.g., /1, /test) and it will be replaced with the predefined input.
 *
 * Also supports @resource-name substitution for saved resources.
 */

export const TEST_INPUTS: Record<string, string> = {
  // Numbered shortcuts
  '/1': 'What is 2 + 2?',
  '/2': 'Explain quantum computing in one sentence.',
  '/3': 'What are the pros and cons of TypeScript?',
  '/4': 'Write a haiku about programming.',
  '/5': 'Should I use React or Vue for a new project?',

  // Named shortcuts
  '/test': 'This is a test message.',
  '/hello': 'Hello! How are you today?',
  '/debate': 'Should pineapple be allowed on pizza?',
  '/code': 'Write a function that reverses a string in JavaScript.',
  '/long': `I'm working on a complex project that involves multiple microservices communicating via message queues. We're using Kubernetes for orchestration and considering moving from REST to gRPC for inter-service communication. What are the key considerations and potential pitfalls I should be aware of?`,
};

/**
 * Expand a slash command to its predefined input, or return the original input if not a command.
 * Note: This only handles slash commands. For @resource substitution, use expandResourceMentions.
 */
export function expandTestInput(input: string): string {
  const trimmed = input.trim();
  return TEST_INPUTS[trimmed] ?? input;
}

/**
 * Check if an input is a slash command (starts with /).
 */
export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

/**
 * Get all available test input commands.
 */
export function getTestInputCommands(): string[] {
  return Object.keys(TEST_INPUTS);
}

/**
 * Pattern to match @resource-name mentions.
 * Matches @ followed by alphanumeric characters, hyphens, or underscores.
 */
const RESOURCE_MENTION_PATTERN = /@([a-zA-Z0-9_-]+)/g;

/**
 * Extract all resource mentions from an input string.
 * Returns array of resource names (without the @ prefix).
 */
export function extractResourceMentions(input: string): string[] {
  const matches = input.matchAll(RESOURCE_MENTION_PATTERN);
  return Array.from(matches, (m) => m[1]);
}

/**
 * Expand @resource mentions in the input using the provided resource lookup function.
 * If a resource is not found, the mention is left unchanged.
 */
export function expandResourceMentions(
  input: string,
  getResourceContent: (name: string) => string | undefined
): string {
  return input.replace(RESOURCE_MENTION_PATTERN, (match, name) => {
    const content = getResourceContent(name);
    return content ?? match; // Keep original if not found
  });
}

/**
 * Expand both slash commands and @resource mentions.
 */
export function expandInput(
  input: string,
  getResourceContent: (name: string) => string | undefined
): string {
  // First expand slash commands (only if the entire input is a slash command)
  let expanded = expandTestInput(input);

  // Then expand @resource mentions
  expanded = expandResourceMentions(expanded, getResourceContent);

  return expanded;
}
