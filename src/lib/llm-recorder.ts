/**
 * LLM Call Recorder
 * Records all LLM API calls to disk for debugging and inspection.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { log } from './logger';

export type LLMCallType = 'chat' | 'complete' | 'agent';

export interface LLMCallRecord {
  id: string;
  timestamp: string;
  callType: LLMCallType;
  conversationId: string;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  options: Record<string, unknown>;
  response: string | null;
  latencyMs: number;
  error: string | null;
}

// Extended record type for agent calls with full request/response details
export interface AgentLLMCallRecord {
  id: string;
  timestamp: string;
  callType: 'agent';
  personaId: string;
  model: string;
  systemPrompt: string;
  // Full request details as sent to Anthropic
  request: {
    messages: unknown[];
    tools: unknown[];
  };
  // All streaming events received
  streamEvents: unknown[];
  // Final response summary
  response: {
    stopReason: string | null;
    contentBlockTypes: string[];
  } | null;
  latencyMs: number;
  error: string | null;
}

const DATA_DIR = path.join(process.cwd(), 'data', 'llm-calls');

/**
 * Ensure the directory for a conversation's recordings exists.
 */
async function ensureDir(conversationId: string): Promise<string> {
  const dir = path.join(DATA_DIR, conversationId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Generate a unique ID for a recording.
 */
function generateRecordId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Record an LLM call to disk.
 */
export async function recordLLMCall(record: Omit<LLMCallRecord, 'id' | 'timestamp'>): Promise<void> {
  const id = generateRecordId();
  const timestamp = new Date().toISOString();
  const filename = `${record.callType}-${Date.now()}.json`;

  const fullRecord: LLMCallRecord = {
    id,
    timestamp,
    ...record,
  };

  try {
    const dir = await ensureDir(record.conversationId);
    const filepath = path.join(dir, filename);
    await fs.writeFile(filepath, JSON.stringify(fullRecord, null, 2));
    log.debug(`Recorded LLM call: ${filepath}`);
  } catch (error) {
    log.error('Failed to record LLM call:', error);
  }
}

/**
 * Record an agent LLM call to disk.
 */
export async function recordAgentLLMCall(record: Omit<AgentLLMCallRecord, 'id' | 'timestamp'>): Promise<void> {
  const id = generateRecordId();
  const timestamp = new Date().toISOString();
  const filename = `agent-${Date.now()}.json`;

  const fullRecord: AgentLLMCallRecord = {
    id,
    timestamp,
    ...record,
  };

  try {
    // Use personaId as the directory
    const dir = await ensureDir(`persona-${record.personaId}`);
    const filepath = path.join(dir, filename);
    await fs.writeFile(filepath, JSON.stringify(fullRecord, null, 2));
    log.debug(`Recorded agent LLM call: ${filepath}`);
  } catch (error) {
    log.error('Failed to record agent LLM call:', error);
  }
}

/**
 * Helper to create an agent call recorder that collects streaming events.
 */
export function createAgentCallRecorder(
  personaId: string,
  model: string,
  systemPrompt: string,
  request: { messages: unknown[]; tools: unknown[] }
) {
  const startTime = Date.now();
  const streamEvents: unknown[] = [];

  return {
    /**
     * Add a streaming event to the recording.
     */
    addEvent(event: unknown): void {
      // Clone to avoid mutation issues
      streamEvents.push(JSON.parse(JSON.stringify(event)));
    },

    /**
     * Record a successful call.
     */
    async success(stopReason: string | null, contentBlockTypes: string[]): Promise<void> {
      await recordAgentLLMCall({
        callType: 'agent',
        personaId,
        model,
        systemPrompt,
        request,
        streamEvents,
        response: { stopReason, contentBlockTypes },
        latencyMs: Date.now() - startTime,
        error: null,
      });
    },

    /**
     * Record a failed call.
     */
    async failure(error: Error | string): Promise<void> {
      await recordAgentLLMCall({
        callType: 'agent',
        personaId,
        model,
        systemPrompt,
        request,
        streamEvents,
        response: null,
        latencyMs: Date.now() - startTime,
        error: typeof error === 'string' ? error : error.message,
      });
    },
  };
}

/**
 * Helper to create a recorder that tracks timing.
 */
export function createCallRecorder(
  callType: LLMCallType,
  conversationId: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  options: Record<string, unknown>
) {
  const startTime = Date.now();

  return {
    /**
     * Record a successful call.
     */
    async success(response: string): Promise<void> {
      await recordLLMCall({
        callType,
        conversationId,
        model,
        systemPrompt,
        messages,
        options,
        response,
        latencyMs: Date.now() - startTime,
        error: null,
      });
    },

    /**
     * Record a failed call.
     */
    async failure(error: Error | string): Promise<void> {
      await recordLLMCall({
        callType,
        conversationId,
        model,
        systemPrompt,
        messages,
        options,
        response: null,
        latencyMs: Date.now() - startTime,
        error: typeof error === 'string' ? error : error.message,
      });
    },
  };
}
