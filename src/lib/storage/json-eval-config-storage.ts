import { promises as fs } from 'fs';
import path from 'path';
import { PromptEnhancerConfig, EvalConfigStorageProvider } from '@/types/slidegen-eval';
import { config } from '../config';

/**
 * JSON file storage for the Prompt Enhancer config.
 * Stores a single config file at data/slidegen-eval/config.json
 */
export class JsonEvalConfigStorageProvider implements EvalConfigStorageProvider {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || config.slidegenEvalDir;
  }

  private getFilePath(): string {
    return path.join(this.dataDir, 'config.json');
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  async getConfig(): Promise<PromptEnhancerConfig | null> {
    try {
      const filePath = this.getFilePath();
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      return {
        ...data,
        updatedAt: new Date(data.updatedAt),
      };
    } catch {
      return null;
    }
  }

  async saveConfig(configData: PromptEnhancerConfig): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.getFilePath();
    await fs.writeFile(filePath, JSON.stringify(configData, null, 2), 'utf-8');
  }
}
