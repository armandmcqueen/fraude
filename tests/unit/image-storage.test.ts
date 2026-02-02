import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { JsonImageStorageProvider } from '@/lib/storage/json-image-storage';

describe('JsonImageStorageProvider', () => {
  let storage: JsonImageStorageProvider;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = path.join(process.cwd(), 'tmp-test-images-' + Date.now());
    storage = new JsonImageStorageProvider(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('listImages', () => {
    it('should return empty array when no images exist', async () => {
      const images = await storage.listImages();
      expect(images).toEqual([]);
    });

    it('should return saved images sorted by date descending', async () => {
      // Save two images
      await storage.saveImage('img1', 'first prompt', 'aGVsbG8=', 'image/png');
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      await storage.saveImage('img2', 'second prompt', 'aGVsbG8=', 'image/png');

      const images = await storage.listImages();
      expect(images).toHaveLength(2);
      // Most recent first
      expect(images[0].id).toBe('img2');
      expect(images[1].id).toBe('img1');
    });
  });

  describe('saveImage', () => {
    it('should save image and return metadata', async () => {
      const base64Data = Buffer.from('test image data').toString('base64');
      const result = await storage.saveImage('test-id', 'a beautiful sunset', base64Data, 'image/png');

      expect(result.id).toBe('test-id');
      expect(result.prompt).toBe('a beautiful sunset');
      expect(result.mimeType).toBe('image/png');
      expect(result.imagePath).toBe('test-id.png');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should create image file on disk', async () => {
      const originalData = 'test image data';
      const base64Data = Buffer.from(originalData).toString('base64');
      await storage.saveImage('test-id', 'prompt', base64Data, 'image/png');

      const imagePath = path.join(testDir, 'test-id.png');
      const fileExists = await fs.access(imagePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const fileContent = await fs.readFile(imagePath);
      expect(fileContent.toString()).toBe(originalData);
    });

    it('should use correct extension from mimeType', async () => {
      await storage.saveImage('jpeg-img', 'prompt', 'aGVsbG8=', 'image/jpeg');

      const image = await storage.getImage('jpeg-img');
      expect(image?.imagePath).toBe('jpeg-img.jpeg');
    });
  });

  describe('getImage', () => {
    it('should return null for non-existent image', async () => {
      const result = await storage.getImage('non-existent');
      expect(result).toBeNull();
    });

    it('should return image metadata', async () => {
      await storage.saveImage('test-id', 'my prompt', 'aGVsbG8=', 'image/png');

      const result = await storage.getImage('test-id');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('test-id');
      expect(result!.prompt).toBe('my prompt');
      expect(result!.mimeType).toBe('image/png');
    });
  });

  describe('getImageData', () => {
    it('should return null for non-existent image', async () => {
      const result = await storage.getImageData('non-existent');
      expect(result).toBeNull();
    });

    it('should return base64 encoded image data', async () => {
      const originalData = 'test image content';
      const base64Data = Buffer.from(originalData).toString('base64');
      await storage.saveImage('test-id', 'prompt', base64Data, 'image/png');

      const result = await storage.getImageData('test-id');
      expect(result).toBe(base64Data);
    });
  });

  describe('deleteImage', () => {
    it('should silently handle non-existent image', async () => {
      // Should not throw
      await storage.deleteImage('non-existent');
    });

    it('should remove image from index', async () => {
      await storage.saveImage('test-id', 'prompt', 'aGVsbG8=', 'image/png');

      const beforeDelete = await storage.listImages();
      expect(beforeDelete).toHaveLength(1);

      await storage.deleteImage('test-id');

      const afterDelete = await storage.listImages();
      expect(afterDelete).toHaveLength(0);
    });

    it('should delete image file from disk', async () => {
      await storage.saveImage('test-id', 'prompt', 'aGVsbG8=', 'image/png');

      const imagePath = path.join(testDir, 'test-id.png');
      let fileExists = await fs.access(imagePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      await storage.deleteImage('test-id');

      fileExists = await fs.access(imagePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });

    it('should handle missing file gracefully', async () => {
      await storage.saveImage('test-id', 'prompt', 'aGVsbG8=', 'image/png');

      // Manually delete the file but not the index entry
      const imagePath = path.join(testDir, 'test-id.png');
      await fs.unlink(imagePath);

      // Should not throw
      await storage.deleteImage('test-id');

      const images = await storage.listImages();
      expect(images).toHaveLength(0);
    });
  });

  describe('persistence', () => {
    it('should persist images across provider instances', async () => {
      // Save with one instance
      await storage.saveImage('persistent-id', 'test prompt', 'aGVsbG8=', 'image/png');

      // Create new instance with same directory
      const storage2 = new JsonImageStorageProvider(testDir);
      const images = await storage2.listImages();

      expect(images).toHaveLength(1);
      expect(images[0].id).toBe('persistent-id');
      expect(images[0].prompt).toBe('test prompt');
    });
  });
});
