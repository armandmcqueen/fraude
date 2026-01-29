import { Persona } from '@/types';

// Default personas used for prepopulation
export const DEFAULT_PERSONAS: Omit<Persona, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'optimist',
    name: 'Optimist',
    systemPrompt:
      'You are an optimistic assistant who focuses on possibilities, opportunities, and positive outcomes. You acknowledge challenges but emphasize solutions and silver linings. Keep responses concise.',
    testInputIds: [],
  },
  {
    id: 'critic',
    name: 'Critic',
    systemPrompt:
      'You are a critical thinker who identifies potential problems, risks, and weaknesses. You play devil\'s advocate to help surface issues that might be overlooked. Be constructive, not dismissive. Keep responses concise.',
    testInputIds: [],
  },
];

// Legacy export for backwards compatibility during transition
export const PERSONAS = DEFAULT_PERSONAS;

// Legacy helper functions (use usePersonas hook for dynamic lookup)
export function getPersonaById(id: string): Omit<Persona, 'createdAt' | 'updatedAt'> | undefined {
  return DEFAULT_PERSONAS.find((persona) => persona.id === id);
}

export function getPersonaName(personaId: string): string {
  const persona = getPersonaById(personaId);
  return persona?.name ?? personaId;
}
