import { NextRequest, NextResponse } from 'next/server';
import { JsonImageStorageProvider } from '@/lib/storage';

const storage = new JsonImageStorageProvider();

// GET /api/storage/images - List all images
export async function GET() {
  const images = await storage.listImages();
  return NextResponse.json(images);
}

// POST /api/storage/images - Save a new image
export async function POST(request: NextRequest) {
  const { id, prompt, base64Data, mimeType } = await request.json();

  if (!id || !prompt || !base64Data || !mimeType) {
    return NextResponse.json(
      { error: 'Missing required fields: id, prompt, base64Data, mimeType' },
      { status: 400 }
    );
  }

  const image = await storage.saveImage(id, prompt, base64Data, mimeType);
  return NextResponse.json(image, { status: 201 });
}
