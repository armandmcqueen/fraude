import { promises as fs } from 'fs';
import path from 'path';
import { Resource, ResourceSummary } from '@/types';
import { ResourceStorageProvider } from './types';
import { config } from '../config';

export class JsonResourceStorageProvider implements ResourceStorageProvider {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || config.resourcesDir;
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

  async listResources(): Promise<ResourceSummary[]> {
    await this.ensureDataDir();

    try {
      const files = await fs.readdir(this.dataDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const summaries: ResourceSummary[] = [];

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.dataDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const resource: Resource = JSON.parse(content);

          summaries.push({
            id: resource.id,
            name: resource.name,
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

  async getResource(id: string): Promise<Resource | null> {
    try {
      const filePath = this.getFilePath(id);
      const content = await fs.readFile(filePath, 'utf-8');
      const resource = JSON.parse(content);

      // Convert date strings back to Date objects
      return {
        ...resource,
        createdAt: new Date(resource.createdAt),
        updatedAt: new Date(resource.updatedAt),
      };
    } catch {
      return null;
    }
  }

  async createResource(resource: Resource): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.getFilePath(resource.id);
    await fs.writeFile(filePath, JSON.stringify(resource, null, 2), 'utf-8');
  }

  async updateResource(resource: Resource): Promise<void> {
    await this.createResource(resource);
  }

  async deleteResource(id: string): Promise<void> {
    try {
      const filePath = this.getFilePath(id);
      await fs.unlink(filePath);
    } catch {
      // File doesn't exist, that's fine
    }
  }
}
