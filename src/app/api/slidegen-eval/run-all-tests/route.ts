import { NextRequest, NextResponse } from 'next/server';
import { testRunner } from '@/services/slidegen-eval';
import { getRequestSource } from '../helpers';

/**
 * POST /api/slidegen-eval/run-all-tests
 * Runs all test cases through the Prompt Enhancer → Image Generator pipeline.
 *
 * Tests run in parallel for faster execution.
 * Progress is emitted via SSE (state-stream) for each test.
 * This endpoint returns when all tests complete.
 */
export async function POST(request: NextRequest) {
  const source = getRequestSource(request);

  try {
    const results = await testRunner.runAllTests(source);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Test run failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
