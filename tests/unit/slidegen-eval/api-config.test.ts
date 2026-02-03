import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { JsonEvalConfigStorageProvider, JsonEvalChangelogStorageProvider } from '@/lib/storage';
import { StateEventEmitterImpl, StateEvent } from '@/services/slidegen-eval';

/**
 * Unit tests for Config API logic.
 *
 * These tests verify the core behavior by directly testing the storage
 * and event emitter components that the API route uses.
 *
 * For full end-to-end API testing, see the integration tests that run
 * against the actual Next.js server.
 */
describe('Config API Logic', () => {
  let testDir: string;
  let configStorage: JsonEvalConfigStorageProvider;
  let changelogStorage: JsonEvalChangelogStorageProvider;
  let emitter: StateEventEmitterImpl;
  let emittedEvents: StateEvent[];

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'tmp-test-api-config-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });

    configStorage = new JsonEvalConfigStorageProvider(testDir);
    changelogStorage = new JsonEvalChangelogStorageProvider(testDir);
    emitter = new StateEventEmitterImpl();
    emittedEvents = [];

    emitter.subscribe((event) => emittedEvents.push(event));
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Config CRUD', () => {
    it('should return null when no config exists', async () => {
      const config = await configStorage.getConfig();
      expect(config).toBeNull();
    });

    it('should create and retrieve config', async () => {
      const config = {
        id: 'default',
        systemPrompt: 'Test prompt',
        version: 1,
        updatedAt: new Date(),
      };

      await configStorage.saveConfig(config);
      const retrieved = await configStorage.getConfig();

      expect(retrieved).not.toBeNull();
      expect(retrieved!.systemPrompt).toBe('Test prompt');
      expect(retrieved!.version).toBe(1);
    });

    it('should update existing config', async () => {
      // Create initial
      await configStorage.saveConfig({
        id: 'default',
        systemPrompt: 'Initial',
        version: 1,
        updatedAt: new Date(),
      });

      // Update
      await configStorage.saveConfig({
        id: 'default',
        systemPrompt: 'Updated',
        version: 2,
        updatedAt: new Date(),
      });

      const config = await configStorage.getConfig();
      expect(config!.systemPrompt).toBe('Updated');
      expect(config!.version).toBe(2);
    });
  });

  describe('SSE Events on Config Update', () => {
    it('should emit config_updated event', () => {
      emittedEvents.length = 0; // Clear connected event

      const config = {
        id: 'default',
        systemPrompt: 'Test',
        version: 1,
        updatedAt: new Date(),
      };

      emitter.emit({ type: 'config_updated', config });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe('config_updated');
      expect((emittedEvents[0] as { config: typeof config }).config.systemPrompt).toBe('Test');
    });
  });

  describe('Changelog on Config Update', () => {
    it('should create changelog entry', async () => {
      await changelogStorage.appendEntry({
        id: 'cl-1',
        timestamp: new Date(),
        source: 'ui',
        action: 'config_updated',
        summary: 'System prompt updated (version 1)',
        details: { version: 1 },
      });

      const entries = await changelogStorage.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('config_updated');
      expect(entries[0].source).toBe('ui');
    });

    it('should track agent vs ui source', async () => {
      await changelogStorage.appendEntry({
        id: 'cl-1',
        timestamp: new Date(),
        source: 'ui',
        action: 'config_updated',
        summary: 'UI update',
      });

      await changelogStorage.appendEntry({
        id: 'cl-2',
        timestamp: new Date(),
        source: 'agent',
        action: 'config_updated',
        summary: 'Agent update',
      });

      const entries = await changelogStorage.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].source).toBe('ui');
      expect(entries[1].source).toBe('agent');
    });
  });

  describe('Version Incrementing', () => {
    it('should increment version on each update', async () => {
      // Simulate the version incrementing logic from the API route
      const getNextVersion = async () => {
        const existing = await configStorage.getConfig();
        return (existing?.version || 0) + 1;
      };

      // First update
      const v1 = await getNextVersion();
      await configStorage.saveConfig({
        id: 'default',
        systemPrompt: 'v1',
        version: v1,
        updatedAt: new Date(),
      });
      expect(v1).toBe(1);

      // Second update
      const v2 = await getNextVersion();
      await configStorage.saveConfig({
        id: 'default',
        systemPrompt: 'v2',
        version: v2,
        updatedAt: new Date(),
      });
      expect(v2).toBe(2);

      // Third update
      const v3 = await getNextVersion();
      expect(v3).toBe(3);
    });
  });
});
