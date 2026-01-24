import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { LLMCallRecord } from '@/lib/llm-recorder';

const DATA_DIR = path.join(process.cwd(), 'data', 'llm-calls');

export interface LLMCallSummary {
  id: string;
  conversationId: string;
  filename: string;
  callType: string;
  model: string;
  timestamp: string;
  latencyMs: number;
  hasError: boolean;
}

/**
 * GET /api/llm-calls
 * Returns a list of all LLM call recordings, sorted by timestamp (newest first).
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Check if directory exists
    try {
      await fs.access(DATA_DIR);
    } catch {
      return NextResponse.json([]);
    }

    const conversationDirs = await fs.readdir(DATA_DIR);
    const summaries: LLMCallSummary[] = [];

    for (const conversationId of conversationDirs) {
      const convDir = path.join(DATA_DIR, conversationId);
      const stat = await fs.stat(convDir);
      if (!stat.isDirectory()) continue;

      const files = await fs.readdir(convDir);
      for (const filename of files) {
        if (!filename.endsWith('.json')) continue;

        const filepath = path.join(convDir, filename);
        const content = await fs.readFile(filepath, 'utf-8');
        const record: LLMCallRecord = JSON.parse(content);

        summaries.push({
          id: record.id,
          conversationId: record.conversationId,
          filename,
          callType: record.callType,
          model: record.model,
          timestamp: record.timestamp,
          latencyMs: record.latencyMs,
          hasError: record.error !== null,
        });
      }
    }

    // Sort by timestamp, newest first
    summaries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json(summaries);
  } catch (error) {
    console.error('Error listing LLM calls:', error);
    return NextResponse.json(
      { error: 'Failed to list LLM calls' },
      { status: 500 }
    );
  }
}
