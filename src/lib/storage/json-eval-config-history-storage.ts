import { promises as fs } from 'fs';
import path from 'path';
import { ConfigVersionSnapshot, EvalConfigHistoryStorageProvider } from '@/types/slidegen-eval';
import { config } from '../config';

/**
 * JSON file storage for config version history.
 * Stores all previous versions at data/slidegen-eval/config-history.json
 */
export class JsonEvalConfigHistoryStorageProvider implements EvalConfigHistoryStorageProvider {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || config.slidegenEvalDir;
  }

  private getFilePath(): string {
    return path.join(this.dataDir, 'config-history.json');
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  private async readHistory(): Promise<ConfigVersionSnapshot[]> {
    try {
      const filePath = this.getFilePath();
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as ConfigVersionSnapshot[];
      return data.map((v) => ({
        ...v,
        // Backward compatibility: add model if missing (default to 'sonnet')
        model: v.model || 'sonnet',
        // Backward compatibility: add imageModel if missing (default to 'gemini-3-pro')
        imageModel: v.imageModel || 'gemini-3-pro',
        savedAt: new Date(v.savedAt),
      }));
    } catch {
      return [];
    }
  }

  private async writeHistory(history: ConfigVersionSnapshot[]): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.getFilePath();
    await fs.writeFile(filePath, JSON.stringify(history, null, 2), 'utf-8');
  }

  async listVersions(): Promise<ConfigVersionSnapshot[]> {
    const history = await this.readHistory();
    // Sort by version descending (newest first)
    return history.sort((a, b) => b.version - a.version);
  }

  async getVersion(version: number): Promise<ConfigVersionSnapshot | null> {
    const history = await this.readHistory();
    return history.find((v) => v.version === version) || null;
  }

  async saveVersion(snapshot: ConfigVersionSnapshot): Promise<void> {
    const history = await this.readHistory();

    // Check if version already exists (shouldn't happen, but be safe)
    const existingIndex = history.findIndex((v) => v.version === snapshot.version);
    if (existingIndex >= 0) {
      history[existingIndex] = snapshot;
    } else {
      history.push(snapshot);
    }

    await this.writeHistory(history);
  }

  async updateVersionName(version: number, name: string): Promise<void> {
    const history = await this.readHistory();
    const versionEntry = history.find((v) => v.version === version);

    if (versionEntry) {
      versionEntry.versionName = name;
      await this.writeHistory(history);
    }
  }
}
