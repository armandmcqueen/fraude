import { promises as fs } from 'fs';
import path from 'path';
import { TestInput, TestInputSummary } from '@/types';
import { TestInputStorageProvider } from './types';
import { config } from '../config';

export class JsonTestInputStorageProvider implements TestInputStorageProvider {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || config.testInputsDir;
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

  async listTestInputs(): Promise<TestInputSummary[]> {
    await this.ensureDataDir();

    try {
      const files = await fs.readdir(this.dataDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const summaries: TestInputSummary[] = [];

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.dataDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const testInput: TestInput = JSON.parse(content);

          summaries.push({
            id: testInput.id,
            content: testInput.content,
          });
        } catch {
          // Skip invalid files
        }
      }

      // Sort by creation time (newest first)
      return summaries;
    } catch {
      return [];
    }
  }

  async getTestInput(id: string): Promise<TestInput | null> {
    try {
      const filePath = this.getFilePath(id);
      const content = await fs.readFile(filePath, 'utf-8');
      const testInput = JSON.parse(content);

      // Convert date strings back to Date objects
      return {
        ...testInput,
        createdAt: new Date(testInput.createdAt),
        updatedAt: new Date(testInput.updatedAt),
      };
    } catch {
      return null;
    }
  }

  async createTestInput(testInput: TestInput): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.getFilePath(testInput.id);
    await fs.writeFile(filePath, JSON.stringify(testInput, null, 2), 'utf-8');
  }

  async updateTestInput(testInput: TestInput): Promise<void> {
    await this.createTestInput(testInput);
  }

  async deleteTestInput(id: string): Promise<void> {
    try {
      const filePath = this.getFilePath(id);
      await fs.unlink(filePath);
    } catch {
      // File doesn't exist, that's fine
    }
  }
}
