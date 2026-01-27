import { NextRequest, NextResponse } from 'next/server';
import { JsonResourceStorageProvider } from '@/lib/storage';
import { Resource } from '@/types';

const storage = new JsonResourceStorageProvider();

// GET /api/storage/resources - List all resources
export async function GET() {
  const resources = await storage.listResources();
  return NextResponse.json(resources);
}

// POST /api/storage/resources - Create a new resource
export async function POST(request: NextRequest) {
  const resource: Resource = await request.json();
  await storage.createResource(resource);
  return NextResponse.json({ success: true }, { status: 201 });
}
