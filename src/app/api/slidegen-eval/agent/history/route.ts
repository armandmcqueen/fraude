import { NextResponse } from 'next/server';
import { JsonEvalAgentSessionStorageProvider } from '@/lib/storage';

const sessionStorage = new JsonEvalAgentSessionStorageProvider();

// We use a single session ID for the slidegen eval agent
const EVAL_SESSION_ID = 'slidegen-eval-session';

/**
 * GET /api/slidegen-eval/agent/history
 * Returns the agent chat history.
 */
export async function GET() {
  const session = await sessionStorage.getSession(EVAL_SESSION_ID);

  if (!session) {
    return NextResponse.json({ turns: [] });
  }

  return NextResponse.json({ turns: session.turns });
}
