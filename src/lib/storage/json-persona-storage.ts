import { promises as fs } from 'fs';
import path from 'path';
import { Persona, PersonaSummary } from '@/types';
import { PersonaStorageProvider } from './types';
import { config } from '../config';
import { DEFAULT_PERSONAS } from '../personas';

export class JsonPersonaStorageProvider implements PersonaStorageProvider {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || config.personasDir;
  }

  private getFilePath(id: string): string {
    return path.join(this.dataDir, `${id}.json`);
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  /**
   * Ensure default personas exist. Called on first GET to lazily initialize.
   */
  async ensureDefaultPersonas(): Promise<void> {
    await this.ensureDataDir();

    // Check if any personas exist
    try {
      const files = await fs.readdir(this.dataDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      // If no personas exist, create defaults
      if (jsonFiles.length === 0) {
        const now = new Date();
        for (const defaultPersona of DEFAULT_PERSONAS) {
          const persona: Persona = {
            ...defaultPersona,
            createdAt: now,
            updatedAt: now,
          };
          await this.createPersona(persona);
        }
      }
    } catch {
      // Directory doesn't exist, will be created with defaults
      const now = new Date();
      for (const defaultPersona of DEFAULT_PERSONAS) {
        const persona: Persona = {
          ...defaultPersona,
          createdAt: now,
          updatedAt: now,
        };
        await this.createPersona(persona);
      }
    }
  }

  async listPersonas(): Promise<PersonaSummary[]> {
    await this.ensureDataDir();

    try {
      const files = await fs.readdir(this.dataDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const summaries: PersonaSummary[] = [];

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.dataDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const persona: Persona = JSON.parse(content);

          summaries.push({
            id: persona.id,
            name: persona.name,
          });
        } catch {
          // Skip invalid files
        }
      }

      // Sort alphabetically by name
      return summaries.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  async getPersona(id: string): Promise<Persona | null> {
    try {
      const filePath = this.getFilePath(id);
      const content = await fs.readFile(filePath, 'utf-8');
      const persona = JSON.parse(content);

      // Convert date strings back to Date objects and handle backwards compatibility
      return {
        ...persona,
        testInputIds: persona.testInputIds || [],  // Default for existing personas
        createdAt: new Date(persona.createdAt),
        updatedAt: new Date(persona.updatedAt),
      };
    } catch {
      return null;
    }
  }

  async createPersona(persona: Persona): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.getFilePath(persona.id);
    await fs.writeFile(filePath, JSON.stringify(persona, null, 2), 'utf-8');
  }

  async updatePersona(persona: Persona): Promise<void> {
    const filePath = this.getFilePath(persona.id);
    await fs.writeFile(filePath, JSON.stringify(persona, null, 2), 'utf-8');
  }

  async deletePersona(id: string): Promise<void> {
    try {
      const filePath = this.getFilePath(id);
      await fs.unlink(filePath);
    } catch {
      // File doesn't exist, that's fine
    }
  }
}
