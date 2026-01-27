import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, getServerUrl, waitForServer } from './server-utils';
import { APISettingsStorageClient } from '@/services/storage/APISettingsStorageClient';

describe('Settings API Tests', () => {
  let settingsClient: APISettingsStorageClient;

  beforeAll(async () => {
    await startServer();
    await waitForServer();

    const serverUrl = getServerUrl();
    settingsClient = new APISettingsStorageClient(`${serverUrl}/api/storage/settings`);
  }, 120000);

  afterAll(async () => {
    await stopServer();
  });

  it('should return default settings when none exist', async () => {
    const settings = await settingsClient.getSettings();
    expect(settings).toHaveProperty('selectedPersonaIds');
    expect(Array.isArray(settings.selectedPersonaIds)).toBe(true);
  });

  it('should save and retrieve settings', async () => {
    const newSettings = {
      selectedPersonaIds: ['critic', 'optimist'],
    };

    await settingsClient.saveSettings(newSettings);

    const retrieved = await settingsClient.getSettings();
    expect(retrieved.selectedPersonaIds).toEqual(['critic', 'optimist']);
  });

  it('should preserve order of persona IDs', async () => {
    const settings1 = { selectedPersonaIds: ['a', 'b', 'c'] };
    await settingsClient.saveSettings(settings1);

    const retrieved1 = await settingsClient.getSettings();
    expect(retrieved1.selectedPersonaIds).toEqual(['a', 'b', 'c']);

    const settings2 = { selectedPersonaIds: ['c', 'a', 'b'] };
    await settingsClient.saveSettings(settings2);

    const retrieved2 = await settingsClient.getSettings();
    expect(retrieved2.selectedPersonaIds).toEqual(['c', 'a', 'b']);
  });

  it('should handle empty selection', async () => {
    const settings = { selectedPersonaIds: [] };
    await settingsClient.saveSettings(settings);

    const retrieved = await settingsClient.getSettings();
    expect(retrieved.selectedPersonaIds).toEqual([]);

    // Restore to default for other tests
    await settingsClient.saveSettings({ selectedPersonaIds: ['optimist', 'critic'] });
  });
});
