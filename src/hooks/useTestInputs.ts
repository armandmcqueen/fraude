'use client';

import { useState, useEffect, useCallback } from 'react';
import { TestInput, TestInputSummary } from '@/types';
import { APITestInputStorageClient } from '@/services';
import { generateId } from '@/lib/utils';

const testInputClient = new APITestInputStorageClient();

export function useTestInputs() {
  const [testInputs, setTestInputs] = useState<TestInputSummary[]>([]);
  const [fullTestInputs, setFullTestInputs] = useState<Map<string, TestInput>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch list of test inputs
  const fetchTestInputs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await testInputClient.listTestInputs();
      setTestInputs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch full test input data for a single ID
  const fetchFullTestInput = useCallback(async (id: string): Promise<TestInput | null> => {
    // Check cache first
    const cached = fullTestInputs.get(id);
    if (cached) return cached;

    try {
      const testInput = await testInputClient.getTestInput(id);
      if (testInput) {
        setFullTestInputs((prev) => new Map(prev).set(id, testInput));
      }
      return testInput;
    } catch {
      return null;
    }
  }, [fullTestInputs]);

  // Initial fetch
  useEffect(() => {
    fetchTestInputs();
  }, [fetchTestInputs]);

  // Create a new test input
  const createTestInput = useCallback(
    async (content: string) => {
      const now = new Date();
      const id = generateId();
      const testInput: TestInput = {
        id,
        content,
        createdAt: now,
        updatedAt: now,
      };

      await testInputClient.createTestInput(testInput);

      // Add to cache
      setFullTestInputs((prev) => new Map(prev).set(id, testInput));

      // Refresh list
      await fetchTestInputs();

      return testInput;
    },
    [fetchTestInputs]
  );

  // Update an existing test input
  const updateTestInput = useCallback(
    async (id: string, content: string) => {
      const existing = await fetchFullTestInput(id);
      if (!existing) {
        throw new Error('Test input not found');
      }

      const updated: TestInput = {
        ...existing,
        content,
        updatedAt: new Date(),
      };

      await testInputClient.updateTestInput(updated);

      // Update cache
      setFullTestInputs((prev) => new Map(prev).set(id, updated));

      // Refresh list
      await fetchTestInputs();

      return updated;
    },
    [fetchFullTestInput, fetchTestInputs]
  );

  // Delete a test input
  const deleteTestInput = useCallback(
    async (id: string) => {
      await testInputClient.deleteTestInput(id);

      // Remove from cache
      setFullTestInputs((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

      // Refresh list
      await fetchTestInputs();
    },
    [fetchTestInputs]
  );

  // Load multiple test inputs by IDs
  const loadTestInputsByIds = useCallback(async (ids: string[]) => {
    const results = await Promise.all(ids.map((id) => fetchFullTestInput(id)));
    return results.filter((t): t is TestInput => t !== null);
  }, [fetchFullTestInput]);

  return {
    testInputs,
    fullTestInputs,
    createTestInput,
    updateTestInput,
    deleteTestInput,
    fetchFullTestInput,
    loadTestInputsByIds,
    loading,
    error,
    refresh: fetchTestInputs,
  };
}
