/**
 * Quick test inputs for development.
 * Type a slash command (e.g., /1, /test) and it will be replaced with the predefined input.
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
