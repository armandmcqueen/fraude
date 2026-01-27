import { Resource, ResourceSummary } from '@/types';
import { ResourceStorageClient } from './types';

/**
 * Resource storage client that uses the Next.js API routes.
 */
export class APIResourceStorageClient implements ResourceStorageClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/storage/resources') {
    this.baseUrl = baseUrl;
  }

  async listResources(): Promise<ResourceSummary[]> {
    const response = await fetch(this.baseUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch resources');
    }

    return response.json();
  }

  async getResource(id: string): Promise<Resource | null> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch resource');
    }

    const data = await response.json();
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  async createResource(resource: Resource): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resource),
    });

    if (!response.ok) {
      throw new Error('Failed to create resource');
    }
  }

  async updateResource(resource: Resource): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${resource.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resource),
    });

    if (!response.ok) {
      throw new Error('Failed to update resource');
    }
  }

  async deleteResource(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete resource');
    }
  }
}
