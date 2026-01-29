import { NextRequest, NextResponse } from 'next/server';
import { JsonTestInputStorageProvider } from '@/lib/storage';
import { TestInput } from '@/types';

const storage = new JsonTestInputStorageProvider();

// GET /api/storage/test-inputs/[id] - Get a specific test input
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const testInput = await storage.getTestInput(id);

  if (!testInput) {
    return NextResponse.json({ error: 'Test input not found' }, { status: 404 });
  }

  return NextResponse.json(testInput);
}

// PUT /api/storage/test-inputs/[id] - Update a test input
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const testInput: TestInput = await request.json();

  // Ensure the ID in the body matches the URL
  if (testInput.id !== id) {
    return NextResponse.json({ error: 'ID mismatch' }, { status: 400 });
  }

  await storage.updateTestInput(testInput);
  return NextResponse.json({ success: true });
}

// DELETE /api/storage/test-inputs/[id] - Delete a test input
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check if test input exists
  const testInput = await storage.getTestInput(id);
  if (!testInput) {
    return NextResponse.json({ error: 'Test input not found' }, { status: 404 });
  }

  await storage.deleteTestInput(id);
  return NextResponse.json({ success: true });
}
