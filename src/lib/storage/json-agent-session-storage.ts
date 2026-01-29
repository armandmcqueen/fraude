import { promises as fs } from 'fs';
import path from 'path';
import { AgentChatSession } from '@/types';
import { AgentSessionStorageProvider } from './types';
import { config } from '../config';

export class JsonAgentSessionStorageProvider implements AgentSessionStorageProvider {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || config.agentSessionsDir;
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

  async getSession(id: string): Promise<AgentChatSession | null> {
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

  async saveSession(session: AgentChatSession): Promise<void> {
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
