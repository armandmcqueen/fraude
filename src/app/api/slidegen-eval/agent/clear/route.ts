import { NextResponse } from 'next/server';
import { JsonEvalAgentSessionStorageProvider } from '@/lib/storage';

const sessionStorage = new JsonEvalAgentSessionStorageProvider();

// We use a single session ID for the slidegen eval agent
const EVAL_SESSION_ID = 'slidegen-eval-session';

/**
 * POST /api/slidegen-eval/agent/clear
 * Clears the agent chat history.
 */
export async function POST() {
  await sessionStorage.deleteSession(EVAL_SESSION_ID);
  return NextResponse.json({ success: true });
}
