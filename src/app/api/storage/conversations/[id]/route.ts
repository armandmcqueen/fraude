import { NextRequest, NextResponse } from 'next/server';
import { JsonStorageProvider } from '@/lib/storage';
import { Conversation } from '@/types';

const storage = new JsonStorageProvider();

// GET /api/storage/conversations/[id] - Get a specific conversation
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = await storage.getConversation(id);

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  return NextResponse.json(conversation);
}

// PUT /api/storage/conversations/[id] - Update a conversation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation: Conversation = await request.json();

  // Ensure the ID in the body matches the URL
  if (conversation.id !== id) {
    return NextResponse.json({ error: 'ID mismatch' }, { status: 400 });
  }

  await storage.updateConversation(conversation);
  return NextResponse.json({ success: true });
}
