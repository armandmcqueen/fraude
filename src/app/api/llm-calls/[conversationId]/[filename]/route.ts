import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'llm-calls');

interface RouteParams {
  params: Promise<{
    conversationId: string;
    filename: string;
  }>;
}

/**
 * GET /api/llm-calls/[conversationId]/[filename]
 * Returns a specific LLM call recording.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { conversationId, filename } = await params;

  try {
    const filepath = path.join(DATA_DIR, conversationId, filename);
    const content = await fs.readFile(filepath, 'utf-8');
    const record = JSON.parse(content);
    return NextResponse.json(record);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }
    console.error('Error reading LLM call:', error);
    return NextResponse.json(
      { error: 'Failed to read LLM call' },
      { status: 500 }
    );
  }
}
