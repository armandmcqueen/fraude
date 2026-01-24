/**
 * LLM Call Recorder
 * Records all LLM API calls to disk for debugging and inspection.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { log } from './logger';

export type LLMCallType = 'chat' | 'complete';

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
