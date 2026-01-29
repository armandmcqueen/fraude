import { NextRequest, NextResponse } from 'next/server';
import { JsonPersonaStorageProvider, JsonAgentSessionStorageProvider } from '@/lib/storage';

const personaStorage = new JsonPersonaStorageProvider();
const sessionStorage = new JsonAgentSessionStorageProvider();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const personaId = searchParams.get('personaId');

  if (!personaId) {
    return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
  }

  // Get persona
  const persona = await personaStorage.getPersona(personaId);
  if (!persona) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  }

  // Get session
  if (!persona.agentChatSessionId) {
    return NextResponse.json({ turns: [] });
  }

  const session = await sessionStorage.getSession(persona.agentChatSessionId);
  if (!session) {
    return NextResponse.json({ turns: [] });
  }

  return NextResponse.json({ turns: session.turns });
}
