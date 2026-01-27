import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, getServerUrl, waitForServer } from './server-utils';
import { APIResourceStorageClient } from '@/services/storage/APIResourceStorageClient';
import { Resource } from '@/types';

describe('Resource API Tests', () => {
  let resourceClient: APIResourceStorageClient;

  beforeAll(async () => {
    await startServer();
    await waitForServer();

    const serverUrl = getServerUrl();
    resourceClient = new APIResourceStorageClient(`${serverUrl}/api/storage/resources`);
  }, 120000);

  afterAll(async () => {
    await stopServer();
  });

  it('should list resources (initially empty or has test data)', async () => {
    const resources = await resourceClient.listResources();
    expect(Array.isArray(resources)).toBe(true);
  });

  it('should create a resource', async () => {
    const now = new Date();
    const resource: Resource = {
      id: 'test-resource-1',
      name: 'test-resource-1',
      content: 'This is test content for resource 1.',
      createdAt: now,
      updatedAt: now,
    };

    await resourceClient.createResource(resource);

    // Verify it was created
    const fetched = await resourceClient.getResource('test-resource-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('test-resource-1');
    expect(fetched?.content).toBe('This is test content for resource 1.');
  });

  it('should get a specific resource', async () => {
    const resource = await resourceClient.getResource('test-resource-1');
    expect(resource).not.toBeNull();
    expect(resource?.id).toBe('test-resource-1');
  });

  it('should return null for non-existent resource', async () => {
    const resource = await resourceClient.getResource('non-existent-resource');
    expect(resource).toBeNull();
  });

  it('should update a resource', async () => {
    const now = new Date();
    const updated: Resource = {
      id: 'test-resource-1',
      name: 'test-resource-1-updated',
      content: 'Updated content.',
      createdAt: now,
      updatedAt: now,
    };

    await resourceClient.updateResource(updated);

    const fetched = await resourceClient.getResource('test-resource-1');
    expect(fetched?.name).toBe('test-resource-1-updated');
    expect(fetched?.content).toBe('Updated content.');
  });

  it('should delete a resource', async () => {
    await resourceClient.deleteResource('test-resource-1');

    const fetched = await resourceClient.getResource('test-resource-1');
    expect(fetched).toBeNull();
  });

  it('should handle resource with special characters in content', async () => {
    const now = new Date();
    const resource: Resource = {
      id: 'test-special-chars',
      name: 'special-chars',
      content: 'Content with "quotes", <tags>, and\nnewlines.',
      createdAt: now,
      updatedAt: now,
    };

    await resourceClient.createResource(resource);

    const fetched = await resourceClient.getResource('test-special-chars');
    expect(fetched?.content).toBe('Content with "quotes", <tags>, and\nnewlines.');

    // Cleanup
    await resourceClient.deleteResource('test-special-chars');
  });

  it('should list resources after creation', async () => {
    const now = new Date();

    // Create two resources
    await resourceClient.createResource({
      id: 'list-test-1',
      name: 'list-test-1',
      content: 'Content 1',
      createdAt: now,
      updatedAt: now,
    });
    await resourceClient.createResource({
      id: 'list-test-2',
      name: 'list-test-2',
      content: 'Content 2',
      createdAt: now,
      updatedAt: now,
    });

    const resources = await resourceClient.listResources();
    const names = resources.map((r) => r.name);

    expect(names).toContain('list-test-1');
    expect(names).toContain('list-test-2');

    // Cleanup
    await resourceClient.deleteResource('list-test-1');
    await resourceClient.deleteResource('list-test-2');
  });
});
