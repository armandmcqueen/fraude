import { NextRequest, NextResponse } from 'next/server';
import { testRunner } from '@/services/slidegen-eval';
import { getRequestSource } from '../helpers';

/**
 * POST /api/slidegen-eval/run-test
 * Runs a single test case through the Prompt Enhancer → Image Generator pipeline.
 *
 * Request body: { testCaseId: string }
 *
 * The test runs asynchronously. Progress is emitted via SSE (state-stream).
 * This endpoint returns when the test completes.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { testCaseId } = body;

  if (typeof testCaseId !== 'string' || !testCaseId) {
    return NextResponse.json(
      { error: 'testCaseId is required' },
      { status: 400 }
    );
  }

  const source = getRequestSource(request);

  try {
    const result = await testRunner.runTest(testCaseId, source);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Test run failed';

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
