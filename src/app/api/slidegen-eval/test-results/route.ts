import { NextResponse } from 'next/server';
import { JsonEvalResultStorageProvider } from '@/lib/storage';

const resultStorage = new JsonEvalResultStorageProvider();

/**
 * GET /api/slidegen-eval/test-results
 * Returns all test results.
 */
export async function GET() {
  const results = await resultStorage.listResults();
  return NextResponse.json({ results });
}
