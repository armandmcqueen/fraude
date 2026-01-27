import { Persona, PersonaSummary } from '@/types';
import { PersonaStorageClient } from './types';

/**
 * Persona storage client that uses the Next.js API routes.
 */
export class APIPersonaStorageClient implements PersonaStorageClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/storage/personas') {
    this.baseUrl = baseUrl;
  }

  async listPersonas(): Promise<PersonaSummary[]> {
    const response = await fetch(this.baseUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch personas');
    }

    return response.json();
  }

  async getPersona(id: string): Promise<Persona | null> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch persona');
    }

    const data = await response.json();
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  async createPersona(persona: Persona): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(persona),
    });

    if (!response.ok) {
      throw new Error('Failed to create persona');
    }
  }

  async deletePersona(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete persona');
    }
  }
}
