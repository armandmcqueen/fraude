import { NextRequest, NextResponse } from 'next/server';
import { JsonImageStorageProvider } from '@/lib/storage';

const storage = new JsonImageStorageProvider();

// GET /api/storage/images/[id] - Get a specific image with its data
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const image = await storage.getImage(id);

  if (!image) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  const data = await storage.getImageData(id);
  if (!data) {
    return NextResponse.json({ error: 'Image data not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...image,
    data, // base64 encoded image data
  });
}

// DELETE /api/storage/images/[id] - Delete an image
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const image = await storage.getImage(id);
  if (!image) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  await storage.deleteImage(id);
  return NextResponse.json({ success: true });
}
