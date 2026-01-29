'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Persona, TestInput, TestInputSummary } from '@/types';
import { APIPersonaStorageClient, APILLMClient, APITestInputStorageClient } from '@/services';
import { config } from '@/lib/config';
import { useDebounce } from './useDebounce';
import { generateId } from '@/lib/utils';

const personaClient = new APIPersonaStorageClient();
const testInputClient = new APITestInputStorageClient();
const llmClient = new APILLMClient();

interface UsePersonaEditorOptions {
  personaId: string;
  autoSaveDelay?: number;
}

export function usePersonaEditor({ personaId, autoSaveDelay = 1000 }: UsePersonaEditorOptions) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [instructions, setInstructions] = useState('');
  const [name, setName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testInputs, setTestInputs] = useState<Map<string, TestInput>>(new Map());
  const [allTestInputs, setAllTestInputs] = useState<TestInputSummary[]>([]);
  const [testResponses, setTestResponses] = useState<Map<string, string>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the last saved instructions to avoid unnecessary saves
  const lastSavedInstructions = useRef<string>('');
  const isInitialLoad = useRef(true);

  // AbortController for cancelling in-flight generation requests
  const generationAbortController = useRef<AbortController | null>(null);
  // Generation version to track if results are stale
  const generationVersion = useRef(0);

  // Debounced instructions for auto-save
  const debouncedInstructions = useDebounce(instructions, autoSaveDelay);

  // Fetch all available test inputs
  const fetchAllTestInputs = useCallback(async () => {
    try {
      const all = await testInputClient.listTestInputs();
      setAllTestInputs(all);
    } catch (err) {
      console.error('Failed to fetch all test inputs:', err);
    }
  }, []);

  // Load persona on mount
  useEffect(() => {
    const loadPersona = async () => {
      try {
        setLoading(true);
        const loadedPersona = await personaClient.getPersona(personaId);
        if (loadedPersona) {
          setPersona(loadedPersona);
          setInstructions(loadedPersona.systemPrompt);
          setName(loadedPersona.name);
          lastSavedInstructions.current = loadedPersona.systemPrompt;

          // Load test inputs for this persona
          const testInputIds = loadedPersona.testInputIds || [];
          const loadedInputs = await Promise.all(
            testInputIds.map((id) => testInputClient.getTestInput(id))
          );
          const inputMap = new Map<string, TestInput>();
          loadedInputs.forEach((input) => {
            if (input) inputMap.set(input.id, input);
          });
          setTestInputs(inputMap);

          // Load all available test inputs
          await fetchAllTestInputs();
        } else {
          setError('Persona not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load persona');
      } finally {
        setLoading(false);
        isInitialLoad.current = false;
      }
    };

    loadPersona();
  }, [personaId, fetchAllTestInputs]);

  // Auto-save when debounced instructions change
  useEffect(() => {
    // Skip during initial load
    if (isInitialLoad.current) return;
    // Skip if instructions haven't actually changed from last save
    if (debouncedInstructions === lastSavedInstructions.current) return;
    // Skip if not dirty
    if (!isDirty) return;

    saveAndRegenerate();
  }, [debouncedInstructions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cancel any in-flight generations
  const cancelGenerations = useCallback(() => {
    if (generationAbortController.current) {
      generationAbortController.current.abort();
      generationAbortController.current = null;
    }
    generationVersion.current += 1;
  }, []);

  // Save persona (fast, doesn't wait for generation)
  const savePersona = useCallback(async () => {
    if (!persona) return;

    setIsSaving(true);
    try {
      const updated: Persona = {
        ...persona,
        systemPrompt: instructions,
        // Unhide on first save if hidden
        hidden: false,
        updatedAt: new Date(),
      };

      await personaClient.updatePersona(updated);
      setPersona(updated);
      lastSavedInstructions.current = instructions;
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save persona');
    } finally {
      setIsSaving(false);
    }
  }, [persona, instructions]);

  // Save persona and regenerate responses (non-blocking generation)
  const saveAndRegenerate = useCallback(async () => {
    // Save first (fast) - this will create the persona if it doesn't exist
    await savePersona();

    // Cancel any in-flight generations and start new ones
    cancelGenerations();

    // Regenerate responses for all test inputs (non-blocking)
    // Note: persona might have just been created, so we need to check current state
    if (persona && persona.testInputIds.length > 0) {
      regenerateAllResponses(instructions);
    }
  }, [persona, instructions, savePersona, cancelGenerations]);

  // Generate a response for a single test input (with abort support)
  const generateResponseForContent = useCallback(
    async (
      testInputId: string,
      content: string,
      systemPrompt: string,
      signal?: AbortSignal
    ): Promise<string> => {
      try {
        const response = await llmClient.complete(
          `persona-editor-${personaId}`,
          systemPrompt,
          content,
          { model: config.utilityModel },
          signal
        );
        return response;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw err; // Re-throw abort errors to handle them specially
        }
        return `[Error: ${err instanceof Error ? err.message : 'Unknown error'}]`;
      }
    },
    [personaId]
  );

  // Generate a response for a single test input (looks up from state)
  const generateResponse = useCallback(
    async (testInputId: string, systemPrompt: string, signal?: AbortSignal): Promise<string> => {
      const testInput = testInputs.get(testInputId);
      if (!testInput) return '[Test input not found]';
      return generateResponseForContent(testInputId, testInput.content, systemPrompt, signal);
    },
    [testInputs, generateResponseForContent]
  );

  // Regenerate responses for all test inputs
  const regenerateAllResponses = useCallback(
    async (systemPrompt?: string) => {
      if (!persona) return;

      const prompt = systemPrompt || instructions;
      const inputIds = persona.testInputIds;

      if (inputIds.length === 0) return;

      // Cancel previous generation and create new abort controller
      cancelGenerations();
      const abortController = new AbortController();
      generationAbortController.current = abortController;
      const currentVersion = generationVersion.current;

      setIsGenerating(true);
      setGeneratingIds(new Set(inputIds));

      try {
        await Promise.all(
          inputIds.map(async (id) => {
            try {
              const response = await generateResponse(id, prompt, abortController.signal);

              // Check if this generation is still current
              if (generationVersion.current !== currentVersion) {
                return; // Stale result, discard
              }

              // Update individual response as it completes
              setTestResponses((prev) => new Map(prev).set(id, response));
              setGeneratingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            } catch (err) {
              // Ignore abort errors, they're expected when cancelling
              if (err instanceof Error && err.name === 'AbortError') {
                return;
              }
              throw err;
            }
          })
        );
      } finally {
        // Only update state if this is still the current generation
        if (generationVersion.current === currentVersion) {
          setIsGenerating(false);
          setGeneratingIds(new Set());
        }
      }
    },
    [persona, instructions, generateResponse, cancelGenerations]
  );

  // Regenerate response for a single test input
  const regenerateSingleResponse = useCallback(
    async (testInputId: string) => {
      setGeneratingIds((prev) => new Set(prev).add(testInputId));

      try {
        const response = await generateResponse(testInputId, instructions);
        setTestResponses((prev) => new Map(prev).set(testInputId, response));
      } finally {
        setGeneratingIds((prev) => {
          const next = new Set(prev);
          next.delete(testInputId);
          return next;
        });
      }
    },
    [generateResponse, instructions]
  );

  // Handle instructions change
  const handleInstructionsChange = useCallback((newInstructions: string) => {
    setInstructions(newInstructions);
    setIsDirty(true);
  }, []);

  // Generate response in the background (fire-and-forget)
  const generateInBackground = useCallback(
    (testInputId: string, content: string) => {
      setGeneratingIds((prev) => new Set(prev).add(testInputId));

      generateResponseForContent(testInputId, content, instructions)
        .then((response) => {
          setTestResponses((prev) => new Map(prev).set(testInputId, response));
        })
        .catch((err) => {
          if (!(err instanceof Error && err.name === 'AbortError')) {
            const errorMsg = `[Error: ${err instanceof Error ? err.message : 'Unknown error'}]`;
            setTestResponses((prev) => new Map(prev).set(testInputId, errorMsg));
          }
        })
        .finally(() => {
          setGeneratingIds((prev) => {
            const next = new Set(prev);
            next.delete(testInputId);
            return next;
          });
        });
    },
    [instructions, generateResponseForContent]
  );

  // Link an existing test input to the persona
  const linkTestInput = useCallback(
    async (testInputId: string) => {
      if (!persona) return;

      // Check if already linked
      if (persona.testInputIds.includes(testInputId)) return;

      // Fetch the test input
      const testInput = await testInputClient.getTestInput(testInputId);
      if (!testInput) return;

      // Update persona with new testInputId (and unhide if hidden)
      const updated: Persona = {
        ...persona,
        testInputIds: [...persona.testInputIds, testInputId],
        hidden: false,
        updatedAt: new Date(),
      };

      await personaClient.updatePersona(updated);
      setPersona(updated);

      // Update local state
      setTestInputs((prev) => new Map(prev).set(testInputId, testInput));

      // Generate response in background (don't await)
      generateInBackground(testInputId, testInput.content);
    },
    [persona, generateInBackground]
  );

  // Create a new test input and add it to the persona
  const createTestInput = useCallback(
    async (content: string) => {
      if (!persona) return;

      const trimmedContent = content.trim();

      // Check if a test input with this content already exists
      const existingInput = allTestInputs.find(
        (input) => input.content.trim() === trimmedContent
      );

      if (existingInput) {
        // If it exists but isn't linked to this persona, link it
        if (!persona.testInputIds.includes(existingInput.id)) {
          await linkTestInput(existingInput.id);
        }
        // If already linked, do nothing
        return;
      }

      // Create the global test input
      const now = new Date();
      const id = generateId();
      const testInput: TestInput = {
        id,
        content: trimmedContent,
        createdAt: now,
        updatedAt: now,
      };

      await testInputClient.createTestInput(testInput);

      // Update persona with new testInputId (and unhide if hidden)
      const updated: Persona = {
        ...persona,
        testInputIds: [...persona.testInputIds, id],
        hidden: false,
        updatedAt: now,
      };

      await personaClient.updatePersona(updated);
      setPersona(updated);

      // Update local state
      setTestInputs((prev) => new Map(prev).set(id, testInput));

      // Refresh all test inputs list (don't await - do in background)
      fetchAllTestInputs();

      // Generate response in background (don't await)
      generateInBackground(id, trimmedContent);

      return testInput;
    },
    [persona, allTestInputs, fetchAllTestInputs, linkTestInput, generateInBackground]
  );

  // Remove a test input from the persona (doesn't delete the global test input)
  const removeTestInput = useCallback(
    async (testInputId: string) => {
      if (!persona) return;

      // Update persona without the testInputId
      const updated: Persona = {
        ...persona,
        testInputIds: persona.testInputIds.filter((id) => id !== testInputId),
        updatedAt: new Date(),
      };

      await personaClient.updatePersona(updated);
      setPersona(updated);

      // Remove from local state
      setTestInputs((prev) => {
        const next = new Map(prev);
        next.delete(testInputId);
        return next;
      });
      setTestResponses((prev) => {
        const next = new Map(prev);
        next.delete(testInputId);
        return next;
      });
    },
    [persona]
  );

  // Update persona name
  const updateName = useCallback(
    async (newName: string) => {
      if (!persona) return;

      setName(newName);

      // Update persona (and unhide if hidden)
      const updated: Persona = {
        ...persona,
        name: newName,
        hidden: false,
        updatedAt: new Date(),
      };

      await personaClient.updatePersona(updated);
      setPersona(updated);
    },
    [persona]
  );

  // Force save (bypass debounce)
  const forceSave = useCallback(async () => {
    if (!isDirty) return;
    await saveAndRegenerate();
  }, [isDirty, saveAndRegenerate]);

  // Refresh persona data from server (used after agent makes changes)
  const refreshPersona = useCallback(async () => {
    try {
      const loadedPersona = await personaClient.getPersona(personaId);
      if (loadedPersona) {
        // Check if system prompt changed
        const systemPromptChanged = loadedPersona.systemPrompt !== lastSavedInstructions.current;

        setPersona(loadedPersona);
        setInstructions(loadedPersona.systemPrompt);
        setName(loadedPersona.name);
        lastSavedInstructions.current = loadedPersona.systemPrompt;
        setIsDirty(false);

        // Reload test inputs for this persona
        const testInputIds = loadedPersona.testInputIds || [];
        const loadedInputs = await Promise.all(
          testInputIds.map((id) => testInputClient.getTestInput(id))
        );
        const inputMap = new Map<string, TestInput>();
        loadedInputs.forEach((input) => {
          if (input) inputMap.set(input.id, input);
        });
        setTestInputs(inputMap);

        // Refresh all available test inputs list
        await fetchAllTestInputs();

        // Update responses and determine what needs regeneration
        setTestResponses((prev) => {
          const next = new Map<string, string>();
          testInputIds.forEach((id) => {
            const existing = prev.get(id);
            if (existing && !systemPromptChanged) {
              next.set(id, existing);
            }
            // If systemPromptChanged, we don't copy existing responses (they'll be regenerated)
          });
          return next;
        });

        // Determine which test inputs need response generation
        const idsToGenerate: string[] = [];
        if (systemPromptChanged) {
          // System prompt changed - regenerate all
          idsToGenerate.push(...testInputIds);
        } else {
          // Find test inputs without responses (newly added)
          setTestResponses((currentResponses) => {
            testInputIds.forEach((id) => {
              if (!currentResponses.has(id)) {
                idsToGenerate.push(id);
              }
            });
            return currentResponses;
          });
        }

        // Generate responses for test inputs that need them
        if (idsToGenerate.length > 0) {
          const newSystemPrompt = loadedPersona.systemPrompt;

          // Mark all as generating
          setGeneratingIds((prev) => {
            const next = new Set(prev);
            idsToGenerate.forEach((id) => next.add(id));
            return next;
          });

          // Generate each response
          idsToGenerate.forEach((testInputId) => {
            const testInput = inputMap.get(testInputId);
            if (testInput) {
              generateResponseForContent(testInputId, testInput.content, newSystemPrompt)
                .then((response) => {
                  setTestResponses((prev) => new Map(prev).set(testInputId, response));
                })
                .catch((err) => {
                  if (!(err instanceof Error && err.name === 'AbortError')) {
                    const errorMsg = `[Error: ${err instanceof Error ? err.message : 'Unknown error'}]`;
                    setTestResponses((prev) => new Map(prev).set(testInputId, errorMsg));
                  }
                })
                .finally(() => {
                  setGeneratingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(testInputId);
                    return next;
                  });
                });
            }
          });
        }
      }
    } catch (err) {
      console.error('Failed to refresh persona:', err);
    }
  }, [personaId, fetchAllTestInputs, generateResponseForContent]);

  return {
    persona,
    instructions,
    setInstructions: handleInstructionsChange,
    name,
    updateName,
    isDirty,
    isSaving,
    isGenerating,
    generatingIds,
    testInputs,
    allTestInputs,
    testResponses,
    createTestInput,
    linkTestInput,
    removeTestInput,
    regenerateAllResponses,
    regenerateSingleResponse,
    forceSave,
    refreshPersona,
    loading,
    error,
  };
}
