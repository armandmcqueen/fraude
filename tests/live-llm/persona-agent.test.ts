import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startServer, stopServer, getServerUrl, waitForServer } from './server-utils';
import { Persona, TestInput } from '@/types';

// =============================================================================
// Types for Agent Stream Events (matches design doc)
// =============================================================================

interface TextDeltaEvent {
  type: 'text_delta';
  content: string;
}

interface TextCompleteEvent {
  type: 'text_complete';
  id: string;
  content: string;
}

interface ToolCallEvent {
  type: 'tool_call';
  id: string;
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
}

interface ToolResultEvent {
  type: 'tool_result';
  id: string;
  toolUseId: string;
  output: string;
  isError?: boolean;
}

interface DoneEvent {
  type: 'done';
}

interface ErrorEvent {
  type: 'error';
  message: string;
}

type AgentStreamEvent =
  | TextDeltaEvent
  | TextCompleteEvent
  | ToolCallEvent
  | ToolResultEvent
  | DoneEvent
  | ErrorEvent;

// =============================================================================
// Test Utilities
// =============================================================================

let serverUrl: string;

/**
 * Send a message to the persona agent and collect all SSE events.
 */
async function sendAgentMessage(
  personaId: string,
  message: string
): Promise<{ events: AgentStreamEvent[]; error?: string }> {
  const response = await fetch(`${serverUrl}/api/persona-agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personaId, message }),
  });

  if (!response.ok) {
    return { events: [], error: `HTTP ${response.status}: ${await response.text()}` };
  }

  const events: AgentStreamEvent[] = [];
  const reader = response.body?.getReader();
  if (!reader) {
    return { events: [], error: 'No response body' };
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data) {
          try {
            const event = JSON.parse(data) as AgentStreamEvent;
            events.push(event);
          } catch {
            console.warn('Failed to parse SSE event:', data);
          }
        }
      }
    }
  }

  return { events };
}

/**
 * Create a test persona via the API.
 */
async function createTestPersona(overrides: Partial<Persona> = {}): Promise<Persona> {
  const id = `test-persona-${Date.now()}`;
  const persona: Persona = {
    id,
    name: overrides.name || 'Test Persona',
    systemPrompt: overrides.systemPrompt || 'You are a helpful test persona.',
    testInputIds: overrides.testInputIds || [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  const response = await fetch(`${serverUrl}/api/storage/personas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(persona),
  });

  if (!response.ok) {
    throw new Error(`Failed to create test persona: ${response.status}`);
  }

  return persona;
}

/**
 * Create a test input via the API.
 */
async function createTestInput(content: string): Promise<TestInput> {
  const id = `test-input-${Date.now()}`;
  const testInput: TestInput = {
    id,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const response = await fetch(`${serverUrl}/api/storage/test-inputs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testInput),
  });

  if (!response.ok) {
    throw new Error(`Failed to create test input: ${response.status}`);
  }

  return testInput;
}

/**
 * Get a persona from the API.
 */
async function getPersona(id: string): Promise<Persona | null> {
  const response = await fetch(`${serverUrl}/api/storage/personas/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to get persona: ${response.status}`);
  return response.json();
}

/**
 * Delete a persona via the API.
 */
async function deletePersona(id: string): Promise<void> {
  await fetch(`${serverUrl}/api/storage/personas/${id}`, { method: 'DELETE' });
}

/**
 * Delete a test input via the API.
 */
async function deleteTestInput(id: string): Promise<void> {
  await fetch(`${serverUrl}/api/storage/test-inputs/${id}`, { method: 'DELETE' });
}

/**
 * Clear agent conversation for a persona.
 */
async function clearAgentConversation(personaId: string): Promise<{ sessionId: string }> {
  const response = await fetch(`${serverUrl}/api/persona-agent/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personaId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to clear conversation: ${response.status}`);
  }

  return response.json();
}

/**
 * Get agent conversation history for a persona.
 */
async function getAgentHistory(personaId: string): Promise<{ turns: unknown[] }> {
  const response = await fetch(`${serverUrl}/api/persona-agent/history?personaId=${personaId}`);
  if (!response.ok) {
    throw new Error(`Failed to get history: ${response.status}`);
  }
  return response.json();
}

/**
 * Extract events of a specific type from the event stream.
 */
function filterEvents<T extends AgentStreamEvent>(
  events: AgentStreamEvent[],
  type: T['type']
): T[] {
  return events.filter((e) => e.type === type) as T[];
}

/**
 * Get the full text from a stream (all text_delta concatenated).
 */
function getFullText(events: AgentStreamEvent[]): string {
  return filterEvents<TextDeltaEvent>(events, 'text_delta')
    .map((e) => e.content)
    .join('');
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Persona Agent Tests', () => {
  let testPersona: Persona;
  const createdPersonaIds: string[] = [];
  const createdTestInputIds: string[] = [];

  beforeAll(async () => {
    await startServer();
    await waitForServer();
    serverUrl = getServerUrl();
  }, 120000);

  afterAll(async () => {
    // Clean up created resources
    for (const id of createdPersonaIds) {
      await deletePersona(id).catch(() => {});
    }
    for (const id of createdTestInputIds) {
      await deleteTestInput(id).catch(() => {});
    }
    await stopServer();
  });

  beforeEach(async () => {
    // Create a fresh test persona for each test
    testPersona = await createTestPersona({
      systemPrompt: 'You are a helpful assistant for testing. Be concise.',
    });
    createdPersonaIds.push(testPersona.id);
  });

  // ===========================================================================
  // Milestone 1: Basic Agent Flow
  // ===========================================================================

  describe('Milestone 1: Agent Responds', () => {
    it('should respond to a simple message with streaming text', async () => {
      const { events, error } = await sendAgentMessage(
        testPersona.id,
        'Say hello in exactly 3 words.'
      );

      expect(error).toBeUndefined();

      // Should have text_delta events
      const textDeltas = filterEvents<TextDeltaEvent>(events, 'text_delta');
      expect(textDeltas.length).toBeGreaterThan(0);

      // Should have text_complete event
      const textCompletes = filterEvents<TextCompleteEvent>(events, 'text_complete');
      expect(textCompletes.length).toBeGreaterThan(0);

      // Should end with done
      const doneEvents = filterEvents<DoneEvent>(events, 'done');
      expect(doneEvents).toHaveLength(1);

      // Should have actual content
      const fullText = getFullText(events);
      expect(fullText.length).toBeGreaterThan(0);
      console.log('Agent response:', fullText);
    }, 60000);

    it('should handle non-existent persona', async () => {
      const { events, error } = await sendAgentMessage(
        'non-existent-persona-id',
        'Hello'
      );

      // Should either return HTTP error or error event
      const hasError = error || filterEvents<ErrorEvent>(events, 'error').length > 0;
      expect(hasError).toBeTruthy();
    }, 30000);
  });

  // ===========================================================================
  // Milestone 2: Agent Reads Data
  // ===========================================================================

  describe('Milestone 2: Agent Reads Data', () => {
    it('should use get_persona tool when asked about the persona', async () => {
      const { events, error } = await sendAgentMessage(
        testPersona.id,
        'What is the current system prompt for this persona? Quote it exactly.'
      );

      expect(error).toBeUndefined();

      // Should have tool_call for get_persona
      const toolCalls = filterEvents<ToolCallEvent>(events, 'tool_call');
      const getPersonaCall = toolCalls.find((tc) => tc.toolName === 'get_persona');
      expect(getPersonaCall).toBeDefined();

      // Should have tool_result
      const toolResults = filterEvents<ToolResultEvent>(events, 'tool_result');
      expect(toolResults.length).toBeGreaterThan(0);

      // Response should mention the system prompt content
      const fullText = getFullText(events);
      expect(fullText.toLowerCase()).toContain('helpful');

      console.log('Tool calls:', toolCalls.map((tc) => tc.toolName));
      console.log('Agent response:', fullText);
    }, 60000);

    it('should use list_test_inputs tool', async () => {
      // Create test inputs and link to persona
      const testInput1 = await createTestInput('What is 2+2?');
      const testInput2 = await createTestInput('Explain quantum computing.');
      createdTestInputIds.push(testInput1.id, testInput2.id);

      // Update persona with test input IDs
      const updatedPersona = { ...testPersona, testInputIds: [testInput1.id, testInput2.id] };
      await fetch(`${serverUrl}/api/storage/personas/${testPersona.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPersona),
      });

      const { events, error } = await sendAgentMessage(
        testPersona.id,
        'What test inputs are configured for this persona?'
      );

      expect(error).toBeUndefined();

      // Should have tool_call for list_test_inputs
      const toolCalls = filterEvents<ToolCallEvent>(events, 'tool_call');
      const listCall = toolCalls.find((tc) => tc.toolName === 'list_test_inputs');
      expect(listCall).toBeDefined();

      // Response should mention the test inputs
      const fullText = getFullText(events);
      expect(fullText).toMatch(/2\+2|quantum/i);

      console.log('Agent response:', fullText);
    }, 60000);
  });

  // ===========================================================================
  // Milestone 3: Agent Modifies Data
  // ===========================================================================

  describe('Milestone 3: Agent Modifies Data', () => {
    it('should update persona name', async () => {
      const newName = `Renamed Persona ${Date.now()}`;

      const { events, error } = await sendAgentMessage(
        testPersona.id,
        `Change this persona's name to "${newName}"`
      );

      expect(error).toBeUndefined();

      // Should have tool_call for update_persona_name
      const toolCalls = filterEvents<ToolCallEvent>(events, 'tool_call');
      const updateCall = toolCalls.find((tc) => tc.toolName === 'update_persona_name');
      expect(updateCall).toBeDefined();
      expect(updateCall?.input.name).toBe(newName);

      // Verify change persisted
      const updatedPersona = await getPersona(testPersona.id);
      expect(updatedPersona?.name).toBe(newName);

      console.log('Updated persona name to:', updatedPersona?.name);
    }, 60000);

    it('should update system prompt', async () => {
      const { events, error } = await sendAgentMessage(
        testPersona.id,
        'Update the system prompt to say: "You are a pirate. Speak like a pirate."'
      );

      expect(error).toBeUndefined();

      // Should have tool_call for update_system_prompt
      const toolCalls = filterEvents<ToolCallEvent>(events, 'tool_call');
      const updateCall = toolCalls.find((tc) => tc.toolName === 'update_system_prompt');
      expect(updateCall).toBeDefined();

      // Verify change persisted
      const updatedPersona = await getPersona(testPersona.id);
      expect(updatedPersona?.systemPrompt.toLowerCase()).toContain('pirate');

      console.log('Updated system prompt to:', updatedPersona?.systemPrompt);
    }, 60000);

    it('should create test input', async () => {
      const { events, error } = await sendAgentMessage(
        testPersona.id,
        'Add a new test input with the content: "What is the meaning of life?"'
      );

      expect(error).toBeUndefined();

      // Should have tool_call for create_test_input
      const toolCalls = filterEvents<ToolCallEvent>(events, 'tool_call');
      const createCall = toolCalls.find((tc) => tc.toolName === 'create_test_input');
      expect(createCall).toBeDefined();

      // Verify persona now has the test input
      const updatedPersona = await getPersona(testPersona.id);
      expect(updatedPersona?.testInputIds.length).toBeGreaterThan(0);

      // Track for cleanup
      if (updatedPersona?.testInputIds) {
        createdTestInputIds.push(...updatedPersona.testInputIds);
      }

      console.log('Created test input, persona now has:', updatedPersona?.testInputIds);
    }, 60000);

    it('should unlink test input', async () => {
      // First create a test input
      const testInput = await createTestInput('To be unlinked');
      createdTestInputIds.push(testInput.id);

      // Link it to persona
      const updatedPersona = { ...testPersona, testInputIds: [testInput.id] };
      await fetch(`${serverUrl}/api/storage/personas/${testPersona.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPersona),
      });

      const { events, error } = await sendAgentMessage(
        testPersona.id,
        'Remove the test input that says "To be unlinked"'
      );

      expect(error).toBeUndefined();

      // Should have tool_call for unlink_test_input (may need list first)
      const toolCalls = filterEvents<ToolCallEvent>(events, 'tool_call');
      const unlinkCall = toolCalls.find((tc) => tc.toolName === 'unlink_test_input');
      expect(unlinkCall).toBeDefined();

      // Verify persona no longer has the test input
      const finalPersona = await getPersona(testPersona.id);
      expect(finalPersona?.testInputIds).not.toContain(testInput.id);

      console.log('Unlinked test input, persona now has:', finalPersona?.testInputIds);
    }, 60000);
  });

  // ===========================================================================
  // Agentic Loop (Multiple Tool Calls)
  // ===========================================================================

  describe('Agentic Loop', () => {
    it('should handle multi-step tasks with multiple tool calls', async () => {
      const { events, error } = await sendAgentMessage(
        testPersona.id,
        'First show me the current persona details, then change the name to "Multi-Step Test"'
      );

      expect(error).toBeUndefined();

      // Should have multiple tool calls
      const toolCalls = filterEvents<ToolCallEvent>(events, 'tool_call');
      expect(toolCalls.length).toBeGreaterThanOrEqual(2);

      // Should have get_persona and update_persona_name
      const toolNames = toolCalls.map((tc) => tc.toolName);
      expect(toolNames).toContain('get_persona');
      expect(toolNames).toContain('update_persona_name');

      // Should have corresponding tool results
      const toolResults = filterEvents<ToolResultEvent>(events, 'tool_result');
      expect(toolResults.length).toBe(toolCalls.length);

      // Should end with done (meaning we got end_turn)
      const doneEvents = filterEvents<DoneEvent>(events, 'done');
      expect(doneEvents).toHaveLength(1);

      console.log('Tool call sequence:', toolNames);
    }, 90000);
  });

  // ===========================================================================
  // Session Persistence
  // ===========================================================================

  describe('Session Persistence', () => {
    it('should persist conversation and maintain context', async () => {
      // First message
      await sendAgentMessage(testPersona.id, 'Remember the code word: BANANA');

      // Second message - should have context
      const { events, error } = await sendAgentMessage(
        testPersona.id,
        'What was the code word I told you?'
      );

      expect(error).toBeUndefined();

      const fullText = getFullText(events);
      expect(fullText.toUpperCase()).toContain('BANANA');

      console.log('Context test response:', fullText);
    }, 90000);

    it('should save turns to session', async () => {
      await sendAgentMessage(testPersona.id, 'Hello agent');

      const history = await getAgentHistory(testPersona.id);
      expect(history.turns.length).toBeGreaterThan(0);

      console.log('Session has', history.turns.length, 'turns');
    }, 60000);

    it('should clear conversation and start fresh', async () => {
      // Send a message
      await sendAgentMessage(testPersona.id, 'Remember: SECRET123');

      // Clear conversation
      const { sessionId } = await clearAgentConversation(testPersona.id);
      expect(sessionId).toBeDefined();

      // New message should not have context
      const { events } = await sendAgentMessage(
        testPersona.id,
        'What secret did I tell you earlier?'
      );

      const fullText = getFullText(events);
      // Should NOT contain the secret (context was cleared)
      expect(fullText).not.toContain('SECRET123');

      console.log('After clear, response:', fullText);
    }, 90000);
  });

  // ===========================================================================
  // Streaming Verification
  // ===========================================================================

  describe('Streaming', () => {
    it('should stream text_delta events progressively', async () => {
      const { events, error } = await sendAgentMessage(
        testPersona.id,
        'Count from 1 to 5, with each number on a new line.'
      );

      expect(error).toBeUndefined();

      // Should have multiple text_delta events (not just one big chunk)
      const textDeltas = filterEvents<TextDeltaEvent>(events, 'text_delta');
      expect(textDeltas.length).toBeGreaterThan(1);

      console.log('Received', textDeltas.length, 'text_delta events');
    }, 60000);

    it('should stream tool events in correct order', async () => {
      const { events, error } = await sendAgentMessage(
        testPersona.id,
        'What is the name of this persona?'
      );

      expect(error).toBeUndefined();

      // Find the sequence of event types
      const eventTypes = events.map((e) => e.type);

      // Tool call should come before its result
      const toolCallIndex = eventTypes.indexOf('tool_call');
      const toolResultIndex = eventTypes.indexOf('tool_result');

      if (toolCallIndex !== -1) {
        expect(toolResultIndex).toBeGreaterThan(toolCallIndex);
      }

      // Done should be last
      expect(eventTypes[eventTypes.length - 1]).toBe('done');

      console.log('Event sequence:', eventTypes);
    }, 60000);
  });
});
