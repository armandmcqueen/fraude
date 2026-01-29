import { TestInput, TestInputSummary } from '@/types';
import { TestInputStorageClient } from './types';

/**
 * Test input storage client that uses the Next.js API routes.
 */
export class APITestInputStorageClient implements TestInputStorageClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/storage/test-inputs') {
    this.baseUrl = baseUrl;
  }

  async listTestInputs(): Promise<TestInputSummary[]> {
    const response = await fetch(this.baseUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch test inputs');
    }

    return response.json();
  }

  async getTestInput(id: string): Promise<TestInput | null> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch test input');
    }

    const data = await response.json();
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  async createTestInput(testInput: TestInput): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testInput),
    });

    if (!response.ok) {
      throw new Error('Failed to create test input');
    }
  }

  async updateTestInput(testInput: TestInput): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${testInput.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testInput),
    });

    if (!response.ok) {
      throw new Error('Failed to update test input');
    }
  }

  async deleteTestInput(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete test input');
    }
  }
}
