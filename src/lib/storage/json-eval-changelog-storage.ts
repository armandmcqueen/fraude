import { promises as fs } from 'fs';
import path from 'path';
import { ChangelogEntry, EvalChangelogStorageProvider } from '@/types/slidegen-eval';
import { config } from '../config';

/**
 * JSON file storage for the changelog.
 * Stores all entries in a single file at data/slidegen-eval/changelog.json
 *
 * The changelog is append-only and can be truncated periodically to prevent
 * unbounded growth.
 */
export class JsonEvalChangelogStorageProvider implements EvalChangelogStorageProvider {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || config.slidegenEvalDir;
  }

  private getFilePath(): string {
    return path.join(this.dataDir, 'changelog.json');
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  private async readEntries(): Promise<ChangelogEntry[]> {
    try {
      const filePath = this.getFilePath();
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      return data.map((entry: ChangelogEntry) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));
    } catch {
      return [];
    }
  }

  private async writeEntries(entries: ChangelogEntry[]): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.getFilePath();
    await fs.writeFile(filePath, JSON.stringify(entries, null, 2), 'utf-8');
  }

  async getEntries(sinceId?: string): Promise<ChangelogEntry[]> {
    const entries = await this.readEntries();

    if (!sinceId) {
      return entries;
    }

    // Find the index of the sinceId entry
    const sinceIndex = entries.findIndex((e) => e.id === sinceId);

    if (sinceIndex === -1) {
      // If the sinceId is not found (maybe truncated), return all entries
      return entries;
    }

    // Return entries after the sinceId
    return entries.slice(sinceIndex + 1);
  }

  async appendEntry(entry: ChangelogEntry): Promise<void> {
    const entries = await this.readEntries();
    entries.push(entry);
    await this.writeEntries(entries);
  }

  async getLatestId(): Promise<string | null> {
    const entries = await this.readEntries();
    if (entries.length === 0) return null;
    return entries[entries.length - 1].id;
  }

  async truncate(keepCount: number): Promise<void> {
    const entries = await this.readEntries();

    if (entries.length <= keepCount) {
      return;
    }

    // Keep only the last keepCount entries
    // Special case: keepCount of 0 means delete all
    const truncated = keepCount === 0 ? [] : entries.slice(-keepCount);
    await this.writeEntries(truncated);
  }
}
