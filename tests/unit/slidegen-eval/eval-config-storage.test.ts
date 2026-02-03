import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { JsonEvalConfigStorageProvider } from '@/lib/storage/json-eval-config-storage';
import { PromptEnhancerConfig } from '@/types/slidegen-eval';

describe('JsonEvalConfigStorageProvider', () => {
  let storage: JsonEvalConfigStorageProvider;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'tmp-test-eval-config-' + Date.now());
    storage = new JsonEvalConfigStorageProvider(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getConfig', () => {
    it('should return null when no config exists', async () => {
      const result = await storage.getConfig();
      expect(result).toBeNull();
    });

    it('should return saved config', async () => {
      const config: PromptEnhancerConfig = {
        id: 'default',
        systemPrompt: 'Test system prompt',
        version: 1,
        updatedAt: new Date(),
      };
      await storage.saveConfig(config);

      const result = await storage.getConfig();
      expect(result).not.toBeNull();
      expect(result!.id).toBe('default');
      expect(result!.systemPrompt).toBe('Test system prompt');
      expect(result!.version).toBe(1);
      expect(result!.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('saveConfig', () => {
    it('should create config file on disk', async () => {
      const config: PromptEnhancerConfig = {
        id: 'default',
        systemPrompt: 'My prompt',
        version: 1,
        updatedAt: new Date(),
      };
      await storage.saveConfig(config);

      const filePath = path.join(testDir, 'config.json');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should overwrite existing config', async () => {
      const config1: PromptEnhancerConfig = {
        id: 'default',
        systemPrompt: 'First prompt',
        version: 1,
        updatedAt: new Date(),
      };
      await storage.saveConfig(config1);

      const config2: PromptEnhancerConfig = {
        id: 'default',
        systemPrompt: 'Second prompt',
        version: 2,
        updatedAt: new Date(),
      };
      await storage.saveConfig(config2);

      const result = await storage.getConfig();
      expect(result!.systemPrompt).toBe('Second prompt');
      expect(result!.version).toBe(2);
    });
  });

  describe('persistence', () => {
    it('should persist config across provider instances', async () => {
      const config: PromptEnhancerConfig = {
        id: 'default',
        systemPrompt: 'Persistent prompt',
        version: 5,
        updatedAt: new Date(),
      };
      await storage.saveConfig(config);

      const storage2 = new JsonEvalConfigStorageProvider(testDir);
      const result = await storage2.getConfig();

      expect(result).not.toBeNull();
      expect(result!.systemPrompt).toBe('Persistent prompt');
      expect(result!.version).toBe(5);
    });
  });
});
