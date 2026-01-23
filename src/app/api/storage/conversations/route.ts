import { NextRequest, NextResponse } from 'next/server';
import { JsonStorageProvider } from '@/lib/storage';
import { Conversation } from '@/types';

const storage = new JsonStorageProvider();

// GET /api/storage/conversations - List all conversations
export async function GET() {
  const conversations = await storage.listConversations();
  return NextResponse.json(conversations);
}

// POST /api/storage/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  const conversation: Conversation = await request.json();
  await storage.createConversation(conversation);
  return NextResponse.json({ success: true }, { status: 201 });
}
