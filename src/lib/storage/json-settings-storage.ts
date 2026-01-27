import { promises as fs } from 'fs';
import path from 'path';
import { UserSettings } from '@/types';
import { SettingsStorageProvider } from './types';
import { config } from '../config';

export class JsonSettingsStorageProvider implements SettingsStorageProvider {
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || config.settingsFile;
  }

  private async ensureDataDir(): Promise<void> {
    const dir = path.dirname(this.filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  async getSettings(): Promise<UserSettings | null> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(this.filePath, JSON.stringify(settings, null, 2), 'utf-8');
  }
}
