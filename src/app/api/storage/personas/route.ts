import { NextRequest, NextResponse } from 'next/server';
import { JsonPersonaStorageProvider } from '@/lib/storage';
import { Persona } from '@/types';

const storage = new JsonPersonaStorageProvider();

// GET /api/storage/personas - List all personas (prepopulates defaults if empty)
export async function GET() {
  // Lazy initialization: ensure defaults exist on first access
  await storage.ensureDefaultPersonas();

  const personas = await storage.listPersonas();
  return NextResponse.json(personas);
}

// POST /api/storage/personas - Create a new persona
export async function POST(request: NextRequest) {
  const persona: Persona = await request.json();
  await storage.createPersona(persona);
  return NextResponse.json({ success: true }, { status: 201 });
}
