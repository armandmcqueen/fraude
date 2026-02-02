import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, getServerUrl, waitForServer, getTestDataDir } from './server-utils';
import { APIImageStorageClient } from '@/services/storage/APIImageStorageClient';
import { promises as fs } from 'fs';
import path from 'path';

describe('Image Generation Live Tests', () => {
  let serverUrl: string;
  let imageStorageClient: APIImageStorageClient;

  beforeAll(async () => {
    await startServer();
    await waitForServer();
    serverUrl = getServerUrl();
    imageStorageClient = new APIImageStorageClient(`${serverUrl}/api/storage/images`);
  }, 120000);

  afterAll(async () => {
    await stopServer();
  });

  describe('Image Generation API', () => {
    it('should generate an image from a prompt', async () => {
      const response = await fetch(`${serverUrl}/api/image-gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A simple red circle on a white background' }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.base64Data).toBeDefined();
      expect(typeof data.base64Data).toBe('string');
      expect(data.base64Data.length).toBeGreaterThan(100); // Should have actual image data

      expect(data.mimeType).toBeDefined();
      expect(data.mimeType).toMatch(/^image\//);

      console.log('Generated image mimeType:', data.mimeType);
      console.log('Generated image data length:', data.base64Data.length);
    }, 60000);

    it('should return error for missing prompt', async () => {
      const response = await fetch(`${serverUrl}/api/image-gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
    }, 10000);
  });

  describe('Image Storage API', () => {
    it('should save and retrieve an image', async () => {
      const testId = `test-${Date.now()}`;
      const testPrompt = 'A test image prompt';
      const testData = Buffer.from('fake image data').toString('base64');
      const testMimeType = 'image/png';

      // Save image
      const saved = await imageStorageClient.saveImage(testId, testPrompt, testData, testMimeType);
      expect(saved.id).toBe(testId);
      expect(saved.prompt).toBe(testPrompt);
      expect(saved.mimeType).toBe(testMimeType);

      // Retrieve image
      const retrieved = await imageStorageClient.getImage(testId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(testId);
      expect(retrieved!.prompt).toBe(testPrompt);
      expect(retrieved!.data).toBe(testData);

      // Clean up
      await imageStorageClient.deleteImage(testId);
    }, 30000);

    it('should list all images', async () => {
      const testId1 = `test-list-1-${Date.now()}`;
      const testId2 = `test-list-2-${Date.now()}`;

      // Save two images
      await imageStorageClient.saveImage(testId1, 'prompt 1', 'ZGF0YTE=', 'image/png');
      await imageStorageClient.saveImage(testId2, 'prompt 2', 'ZGF0YTI=', 'image/png');

      // List images
      const images = await imageStorageClient.listImages();
      const ids = images.map((img) => img.id);

      expect(ids).toContain(testId1);
      expect(ids).toContain(testId2);

      // Clean up
      await imageStorageClient.deleteImage(testId1);
      await imageStorageClient.deleteImage(testId2);
    }, 30000);

    it('should delete an image', async () => {
      const testId = `test-delete-${Date.now()}`;

      // Save and verify it exists
      await imageStorageClient.saveImage(testId, 'prompt', 'ZGF0YQ==', 'image/png');
      let image = await imageStorageClient.getImage(testId);
      expect(image).not.toBeNull();

      // Delete
      await imageStorageClient.deleteImage(testId);

      // Verify it's gone
      image = await imageStorageClient.getImage(testId);
      expect(image).toBeNull();
    }, 30000);
  });

  describe('Full Image Generation Flow', () => {
    it('should generate, save, and retrieve an image', async () => {
      // 1. Generate image
      console.log('Generating image...');
      const genResponse = await fetch(`${serverUrl}/api/image-gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A blue square' }),
      });

      expect(genResponse.ok).toBe(true);
      const { base64Data, mimeType } = await genResponse.json();
      console.log('Image generated, size:', base64Data.length, 'bytes');

      // 2. Save image
      const imageId = `flow-test-${Date.now()}`;
      const saved = await imageStorageClient.saveImage(imageId, 'A blue square', base64Data, mimeType);
      expect(saved.id).toBe(imageId);
      console.log('Image saved with id:', imageId);

      // 3. Verify it appears in list
      const images = await imageStorageClient.listImages();
      const found = images.find((img) => img.id === imageId);
      expect(found).toBeDefined();
      expect(found!.prompt).toBe('A blue square');

      // 4. Retrieve full image data
      const retrieved = await imageStorageClient.getImage(imageId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.data).toBe(base64Data);
      console.log('Image retrieved successfully');

      // 5. Verify file exists on disk
      const testDataDir = getTestDataDir();
      const ext = mimeType.split('/')[1] || 'png';
      const imagePath = path.join(testDataDir, 'images', `${imageId}.${ext}`);
      const fileExists = await fs.access(imagePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      console.log('Image file exists at:', imagePath);

      // 6. Clean up
      await imageStorageClient.deleteImage(imageId);
      const afterDelete = await imageStorageClient.getImage(imageId);
      expect(afterDelete).toBeNull();
      console.log('Image deleted successfully');
    }, 90000);
  });
});
