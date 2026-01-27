import { NextRequest, NextResponse } from 'next/server';
import { JsonResourceStorageProvider } from '@/lib/storage';
import { Resource } from '@/types';

const storage = new JsonResourceStorageProvider();

// GET /api/storage/resources/[id] - Get a specific resource
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const resource = await storage.getResource(id);

  if (!resource) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  return NextResponse.json(resource);
}

// PUT /api/storage/resources/[id] - Update a resource
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const resource: Resource = await request.json();

  // Ensure the ID in the body matches the URL
  if (resource.id !== id) {
    return NextResponse.json({ error: 'ID mismatch' }, { status: 400 });
  }

  await storage.updateResource(resource);
  return NextResponse.json({ success: true });
}

// DELETE /api/storage/resources/[id] - Delete a resource
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check if resource exists
  const resource = await storage.getResource(id);
  if (!resource) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  await storage.deleteResource(id);
  return NextResponse.json({ success: true });
}
