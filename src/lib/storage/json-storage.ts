import { promises as fs } from 'fs';
import path from 'path';
import { Conversation, ConversationSummary } from '@/types';
import { StorageProvider } from './types';
import { config } from '../config';

export class JsonStorageProvider implements StorageProvider {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || config.dataDir;
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

  async listConversations(): Promise<ConversationSummary[]> {
    await this.ensureDataDir();

    try {
      const files = await fs.readdir(this.dataDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const summaries: ConversationSummary[] = [];

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.dataDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const conv: Conversation = JSON.parse(content);

          summaries.push({
            id: conv.id,
            title: conv.title,
            updatedAt: new Date(conv.updatedAt),
            messageCount: conv.messages.length,
          });
        } catch {
          // Skip invalid files
        }
      }

      // Sort by updatedAt descending (most recent first)
      return summaries.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );
    } catch {
      return [];
    }
  }

  async getConversation(id: string): Promise<Conversation | null> {
    try {
      const filePath = this.getFilePath(id);
      const content = await fs.readFile(filePath, 'utf-8');
      const conv = JSON.parse(content);

      // Convert date strings back to Date objects
      return {
        ...conv,
        createdAt: new Date(conv.createdAt),
        updatedAt: new Date(conv.updatedAt),
        messages: conv.messages.map((m: Conversation['messages'][0]) => ({
          ...m,
          createdAt: new Date(m.createdAt),
        })),
      };
    } catch {
      return null;
    }
  }

  async createConversation(conversation: Conversation): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.getFilePath(conversation.id);
    await fs.writeFile(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
  }

  async updateConversation(conversation: Conversation): Promise<void> {
    // For JSON storage, create and update are the same operation
    await this.createConversation(conversation);
  }
}
