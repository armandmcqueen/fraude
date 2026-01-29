import { NextRequest, NextResponse } from 'next/server';
import { JsonPersonaStorageProvider, JsonAgentSessionStorageProvider } from '@/lib/storage';
import { AgentChatSession } from '@/types';

const personaStorage = new JsonPersonaStorageProvider();
const sessionStorage = new JsonAgentSessionStorageProvider();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

interface ClearRequest {
  personaId: string;
}

export async function POST(request: NextRequest) {
  const { personaId }: ClearRequest = await request.json();

  // Get persona
  const persona = await personaStorage.getPersona(personaId);
  if (!persona) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  }

  // Delete old session if exists
  if (persona.agentChatSessionId) {
    await sessionStorage.deleteSession(persona.agentChatSessionId);
  }

  // Create new session
  const newSession: AgentChatSession = {
    id: generateId(),
    personaId,
    turns: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await sessionStorage.saveSession(newSession);

  // Update persona
  persona.agentChatSessionId = newSession.id;
  persona.updatedAt = new Date();
  await personaStorage.updatePersona(persona);

  return NextResponse.json({ sessionId: newSession.id });
}
