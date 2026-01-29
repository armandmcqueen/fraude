'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Persona, PersonaSummary } from '@/types';
import { APIPersonaStorageClient, APISettingsStorageClient } from '@/services';
import { generateId } from '@/lib/utils';

const personaClient = new APIPersonaStorageClient();
const settingsClient = new APISettingsStorageClient();

export function usePersonas() {
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fullPersonas, setFullPersonas] = useState<Map<string, Persona>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const isInitialMount = useRef(true);

  // Fetch list of personas
  const fetchPersonas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await personaClient.listPersonas();
      setPersonas(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Load saved settings and reconcile with available personas
  const loadSettings = useCallback(async (availablePersonas: PersonaSummary[]) => {
    try {
      const settings = await settingsClient.getSettings();
      const availableIds = new Set(availablePersonas.map((p) => p.id));

      // Filter out any saved persona IDs that no longer exist
      const validIds = settings.selectedPersonaIds.filter((id) => availableIds.has(id));

      // If no valid IDs remain, fall back to defaults
      if (validIds.length === 0) {
        const defaults = ['optimist', 'critic'].filter((id) => availableIds.has(id));
        setSelectedIds(defaults.length > 0 ? defaults : [availablePersonas[0]?.id].filter(Boolean));
      } else {
        setSelectedIds(validIds);
      }
    } catch {
      // On error, use defaults
      const availableIds = new Set(availablePersonas.map((p) => p.id));
      const defaults = ['optimist', 'critic'].filter((id) => availableIds.has(id));
      setSelectedIds(defaults.length > 0 ? defaults : [availablePersonas[0]?.id].filter(Boolean));
    } finally {
      setSettingsLoaded(true);
    }
  }, []);

  // Save settings when selection changes (but not on initial load)
  const saveSettings = useCallback(async (ids: string[]) => {
    try {
      await settingsClient.saveSettings({ selectedPersonaIds: ids });
    } catch (err) {
      console.error('Failed to save persona selection:', err);
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

  // Initial fetch - load personas then settings
  useEffect(() => {
    const init = async () => {
      const availablePersonas = await fetchPersonas();
      await loadSettings(availablePersonas);
    };
    init();
  }, [fetchPersonas, loadSettings]);

  // Save settings when selection changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      if (settingsLoaded) {
        isInitialMount.current = false;
      }
      return;
    }
    if (selectedIds.length > 0) {
      saveSettings(selectedIds);
    }
  }, [selectedIds, settingsLoaded, saveSettings]);

  // Create a new persona
  const createPersona = useCallback(
    async (name: string, systemPrompt: string) => {
      const now = new Date();
      const id = generateId();
      const persona: Persona = {
        id,
        name,
        systemPrompt,
        testInputIds: [],
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

  // Update a persona
  const updatePersona = useCallback(
    async (id: string, name: string, systemPrompt: string) => {
      const existing = await personaClient.getPersona(id);
      if (!existing) {
        throw new Error('Persona not found');
      }

      const updated: Persona = {
        ...existing,
        name,
        systemPrompt,
        updatedAt: new Date(),
      };

      await personaClient.updatePersona(updated);

      // Update cache
      setFullPersonas((prev) => new Map(prev).set(id, updated));

      // Refresh list to update names
      await fetchPersonas();

      return updated;
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
    fetchFullPersona,
    createPersona,
    updatePersona,
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
