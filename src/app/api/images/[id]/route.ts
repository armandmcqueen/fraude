import { NextRequest, NextResponse } from 'next/server';
import { JsonImageStorageProvider } from '@/lib/storage';

const storage = new JsonImageStorageProvider();

/**
 * GET /api/images/[id] - Serve image as binary with correct content-type.
 * This endpoint is designed for use in <img> tags.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const image = await storage.getImage(id);
  if (!image) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  const base64Data = await storage.getImageData(id);
  if (!base64Data) {
    return NextResponse.json({ error: 'Image data not found' }, { status: 404 });
  }

  // Convert base64 to binary
  const binaryData = Buffer.from(base64Data, 'base64');

  return new NextResponse(binaryData, {
    headers: {
      'Content-Type': image.mimeType || 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
