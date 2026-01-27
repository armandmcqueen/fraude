'use client';

import { useState, useEffect, useCallback } from 'react';
import { Resource, ResourceSummary } from '@/types';
import { APIResourceStorageClient } from '@/services';
import { generateId } from '@/lib/utils';

const resourceClient = new APIResourceStorageClient();

/**
 * Convert a resource name to a URL-safe ID.
 * e.g., "Project Context" -> "project-context"
 */
function nameToId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function useResources() {
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [fullResources, setFullResources] = useState<Map<string, Resource>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch list of resources
  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      const data = await resourceClient.listResources();
      setResources(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch full resource data for a single ID
  const fetchFullResource = useCallback(async (id: string): Promise<Resource | null> => {
    // Check cache first
    const cached = fullResources.get(id);
    if (cached) return cached;

    try {
      const resource = await resourceClient.getResource(id);
      if (resource) {
        setFullResources((prev) => new Map(prev).set(id, resource));
      }
      return resource;
    } catch {
      return null;
    }
  }, [fullResources]);

  // Initial fetch
  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // Create a new resource
  const createResource = useCallback(
    async (name: string, content: string) => {
      const now = new Date();
      const id = nameToId(name) || generateId();
      const resource: Resource = {
        id,
        name,
        content,
        createdAt: now,
        updatedAt: now,
      };

      await resourceClient.createResource(resource);

      // Add to cache
      setFullResources((prev) => new Map(prev).set(id, resource));

      // Refresh list
      await fetchResources();

      return resource;
    },
    [fetchResources]
  );

  // Update an existing resource
  const updateResource = useCallback(
    async (id: string, name: string, content: string) => {
      const existing = await fetchFullResource(id);
      if (!existing) {
        throw new Error('Resource not found');
      }

      const updated: Resource = {
        ...existing,
        name,
        content,
        updatedAt: new Date(),
      };

      await resourceClient.updateResource(updated);

      // Update cache
      setFullResources((prev) => new Map(prev).set(id, updated));

      // Refresh list (name might have changed)
      await fetchResources();

      return updated;
    },
    [fetchFullResource, fetchResources]
  );

  // Delete a resource
  const deleteResource = useCallback(
    async (id: string) => {
      await resourceClient.deleteResource(id);

      // Remove from cache
      setFullResources((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

      // Refresh list
      await fetchResources();
    },
    [fetchResources]
  );

  // Get resource content by name (for substitution)
  const getResourceByName = useCallback(
    (name: string): Resource | undefined => {
      // First check cache
      for (const resource of fullResources.values()) {
        if (resource.name.toLowerCase() === name.toLowerCase()) {
          return resource;
        }
      }
      // Then check summaries
      const summary = resources.find(
        (r) => r.name.toLowerCase() === name.toLowerCase()
      );
      if (summary) {
        return fullResources.get(summary.id);
      }
      return undefined;
    },
    [resources, fullResources]
  );

  // Load all resources fully (for substitution)
  const loadAllResources = useCallback(async () => {
    await Promise.all(resources.map((r) => fetchFullResource(r.id)));
  }, [resources, fetchFullResource]);

  return {
    resources,
    fullResources,
    createResource,
    updateResource,
    deleteResource,
    getResourceByName,
    fetchFullResource,
    loadAllResources,
    loading,
    error,
    refresh: fetchResources,
  };
}
