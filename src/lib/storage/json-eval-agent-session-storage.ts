import { promises as fs } from 'fs';
import path from 'path';
import {
  SlidegenEvalAgentSession,
  SlidegenEvalAgentSessionStorageProvider,
} from '@/types/slidegen-eval';
import { config } from '../config';

/**
 * JSON file-based storage for slidegen eval agent chat sessions.
 * Each session is stored in a separate file: data/slidegen-eval/agent-sessions/{id}.json
 */
export class JsonEvalAgentSessionStorageProvider implements SlidegenEvalAgentSessionStorageProvider {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || `${config.slidegenEvalDir}/agent-sessions`;
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

  async getSession(id: string): Promise<SlidegenEvalAgentSession | null> {
    try {
      const filePath = this.getFilePath(id);
      const content = await fs.readFile(filePath, 'utf-8');
      const session = JSON.parse(content);

      // Convert date strings back to Date objects
      return {
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        turns: session.turns.map((turn: Record<string, unknown>) => ({
          ...turn,
          createdAt: new Date(turn.createdAt as string),
        })),
      };
    } catch {
      return null;
    }
  }

  async saveSession(session: SlidegenEvalAgentSession): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.getFilePath(session.id);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  async deleteSession(id: string): Promise<void> {
    try {
      const filePath = this.getFilePath(id);
      await fs.unlink(filePath);
    } catch {
      // File doesn't exist, that's fine
    }
  }
}
