'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Persona, PersonaSummary } from '@/types';
import { APIPersonaStorageClient } from '@/services';
import { generateId } from '@/lib/utils';

const personaClient = new APIPersonaStorageClient();

export function usePersonas() {
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(['optimist', 'critic']);
  const [fullPersonas, setFullPersonas] = useState<Map<string, Persona>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch list of personas
  const fetchPersonas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await personaClient.listPersonas();
      setPersonas(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch full persona data for a single ID
  const fetchFullPersona = useCallback(async (id: string): Promise<Persona | null> => {
    // Check cache first
    const cached = fullPersonas.get(id);
    if (cached) return cached;

    try {
      const persona = await personaClient.getPersona(id);
      if (persona) {
        setFullPersonas((prev) => new Map(prev).set(id, persona));
      }
      return persona;
    } catch {
      return null;
    }
  }, [fullPersonas]);

  // Fetch full data for all selected personas
  const fetchSelectedPersonas = useCallback(async () => {
    const results = await Promise.all(
      selectedIds.map((id) => fetchFullPersona(id))
    );
    return results.filter((p): p is Persona => p !== null);
  }, [selectedIds, fetchFullPersona]);

  // Selected personas as full Persona objects
  const [selectedPersonas, setSelectedPersonas] = useState<Persona[]>([]);

  // Update selected personas when selection changes
  useEffect(() => {
    fetchSelectedPersonas().then(setSelectedPersonas);
  }, [fetchSelectedPersonas]);

  // Initial fetch
  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  // Create a new persona
  const createPersona = useCallback(
    async (name: string, systemPrompt: string) => {
      const now = new Date();
      const id = generateId();
      const persona: Persona = {
        id,
        name,
        systemPrompt,
        createdAt: now,
        updatedAt: now,
      };

      await personaClient.createPersona(persona);

      // Add to cache
      setFullPersonas((prev) => new Map(prev).set(id, persona));

      // Refresh list
      await fetchPersonas();

      return persona;
    },
    [fetchPersonas]
  );

  // Delete a persona
  const deletePersona = useCallback(
    async (id: string) => {
      await personaClient.deletePersona(id);

      // Remove from cache
      setFullPersonas((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

      // Remove from selection if selected
      setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));

      // Refresh list
      await fetchPersonas();
    },
    [fetchPersonas]
  );

  // Toggle selection of a persona
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        // Don't allow deselecting if it's the last one
        if (prev.length <= 1) return prev;
        return prev.filter((selectedId) => selectedId !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  // Move a persona up in the order (earlier in response sequence)
  const moveUp = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const index = prev.indexOf(id);
      if (index <= 0) return prev; // Already first or not found
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  // Move a persona down in the order (later in response sequence)
  const moveDown = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const index = prev.indexOf(id);
      if (index < 0 || index >= prev.length - 1) return prev; // Already last or not found
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  // Get persona name by ID (for display)
  const getPersonaName = useCallback(
    (personaId: string): string => {
      const persona = personas.find((p) => p.id === personaId);
      return persona?.name ?? personaId;
    },
    [personas]
  );

  return {
    personas,
    selectedIds,
    setSelectedIds,
    selectedPersonas,
    createPersona,
    deletePersona,
    toggleSelection,
    moveUp,
    moveDown,
    getPersonaName,
    loading,
    error,
    refresh: fetchPersonas,
  };
}
