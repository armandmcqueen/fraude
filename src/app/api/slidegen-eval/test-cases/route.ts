import { NextRequest, NextResponse } from 'next/server';
import { JsonEvalTestCaseStorageProvider } from '@/lib/storage';
import { stateEventEmitter } from '@/services/slidegen-eval';
import { EvalTestCase } from '@/types/slidegen-eval';
import { generateId, createChangelogEntry, getRequestSource } from '../helpers';

const testCaseStorage = new JsonEvalTestCaseStorageProvider();

/**
 * GET /api/slidegen-eval/test-cases
 * Returns all test cases (summaries with truncated input text).
 */
export async function GET() {
  const testCases = await testCaseStorage.listTestCases();
  return NextResponse.json({ testCases });
}

/**
 * POST /api/slidegen-eval/test-cases
 * Creates a new test case.
 *
 * Request body: { name: string, inputText: string }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, inputText } = body;

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json(
      { error: 'name is required and must be a non-empty string' },
      { status: 400 }
    );
  }

  if (typeof inputText !== 'string') {
    return NextResponse.json(
      { error: 'inputText is required and must be a string' },
      { status: 400 }
    );
  }

  const now = new Date();
  const testCase: EvalTestCase = {
    id: generateId(),
    name: name.trim(),
    inputText,
    createdAt: now,
    updatedAt: now,
  };

  await testCaseStorage.createTestCase(testCase);

  // Emit SSE event
  stateEventEmitter.emit({
    type: 'test_case_added',
    testCase,
  });

  // Create changelog entry
  const source = getRequestSource(request);
  await createChangelogEntry(
    source,
    'test_case_created',
    `Test case "${testCase.name}" created`,
    { testCaseId: testCase.id, name: testCase.name }
  );

  return NextResponse.json({ testCase }, { status: 201 });
}
