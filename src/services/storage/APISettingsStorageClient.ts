import { UserSettings } from '@/types';
import { SettingsStorageClient } from './types';

/**
 * Settings storage client that uses the Next.js API routes.
 */
export class APISettingsStorageClient implements SettingsStorageClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/storage/settings') {
    this.baseUrl = baseUrl;
  }

  async getSettings(): Promise<UserSettings> {
    const response = await fetch(this.baseUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch settings');
    }

    return response.json();
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      throw new Error('Failed to save settings');
    }
  }
}
