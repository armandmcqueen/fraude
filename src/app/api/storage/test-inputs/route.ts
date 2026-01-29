import { NextRequest, NextResponse } from 'next/server';
import { JsonTestInputStorageProvider } from '@/lib/storage';
import { TestInput } from '@/types';

const storage = new JsonTestInputStorageProvider();

// GET /api/storage/test-inputs - List all test inputs
export async function GET() {
  const testInputs = await storage.listTestInputs();
  return NextResponse.json(testInputs);
}

// POST /api/storage/test-inputs - Create a new test input
export async function POST(request: NextRequest) {
  const testInput: TestInput = await request.json();
  await storage.createTestInput(testInput);
  return NextResponse.json({ success: true }, { status: 201 });
}
