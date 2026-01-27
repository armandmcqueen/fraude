import { NextRequest, NextResponse } from 'next/server';
import { JsonPersonaStorageProvider } from '@/lib/storage';

const storage = new JsonPersonaStorageProvider();

// GET /api/storage/personas/[id] - Get a specific persona
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const persona = await storage.getPersona(id);

  if (!persona) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  }

  return NextResponse.json(persona);
}

// DELETE /api/storage/personas/[id] - Delete a persona
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check if persona exists
  const persona = await storage.getPersona(id);
  if (!persona) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  }

  await storage.deletePersona(id);
  return NextResponse.json({ success: true });
}
