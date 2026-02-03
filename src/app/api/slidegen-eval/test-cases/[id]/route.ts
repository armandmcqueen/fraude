import { NextRequest, NextResponse } from 'next/server';
import { JsonEvalTestCaseStorageProvider, JsonEvalResultStorageProvider } from '@/lib/storage';
import { stateEventEmitter } from '@/services/slidegen-eval';
import { createChangelogEntry, getRequestSource } from '../../helpers';

const testCaseStorage = new JsonEvalTestCaseStorageProvider();
const resultStorage = new JsonEvalResultStorageProvider();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/slidegen-eval/test-cases/[id]
 * Returns a single test case by ID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const testCase = await testCaseStorage.getTestCase(id);

  if (!testCase) {
    return NextResponse.json(
      { error: 'Test case not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ testCase });
}

/**
 * PUT /api/slidegen-eval/test-cases/[id]
 * Updates an existing test case.
 *
 * Request body: { name?: string, inputText?: string }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json();
  const { name, inputText } = body;

  const existingTestCase = await testCaseStorage.getTestCase(id);
  if (!existingTestCase) {
    return NextResponse.json(
      { error: 'Test case not found' },
      { status: 404 }
    );
  }

  // Update fields if provided
  const updatedTestCase = {
    ...existingTestCase,
    name: typeof name === 'string' && name.trim() ? name.trim() : existingTestCase.name,
    inputText: typeof inputText === 'string' ? inputText : existingTestCase.inputText,
    updatedAt: new Date(),
  };

  await testCaseStorage.updateTestCase(updatedTestCase);

  // Emit SSE event
  stateEventEmitter.emit({
    type: 'test_case_updated',
    testCase: updatedTestCase,
  });

  // Create changelog entry
  const source = getRequestSource(request);
  const changes: string[] = [];
  if (name !== undefined && name !== existingTestCase.name) changes.push('name');
  if (inputText !== undefined && inputText !== existingTestCase.inputText) changes.push('input text');

  await createChangelogEntry(
    source,
    'test_case_updated',
    `Test case "${updatedTestCase.name}" updated (${changes.join(', ') || 'no changes'})`,
    { testCaseId: id, name: updatedTestCase.name, changes }
  );

  return NextResponse.json({ testCase: updatedTestCase });
}

/**
 * DELETE /api/slidegen-eval/test-cases/[id]
 * Deletes a test case and its associated results.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const existingTestCase = await testCaseStorage.getTestCase(id);
  if (!existingTestCase) {
    return NextResponse.json(
      { error: 'Test case not found' },
      { status: 404 }
    );
  }

  // Delete test case and associated results
  await testCaseStorage.deleteTestCase(id);
  await resultStorage.deleteResultsForTestCase(id);

  // Emit SSE event
  stateEventEmitter.emit({
    type: 'test_case_deleted',
    testCaseId: id,
  });

  // Create changelog entry
  const source = getRequestSource(request);
  await createChangelogEntry(
    source,
    'test_case_deleted',
    `Test case "${existingTestCase.name}" deleted`,
    { testCaseId: id, name: existingTestCase.name }
  );

  return NextResponse.json({ success: true });
}
