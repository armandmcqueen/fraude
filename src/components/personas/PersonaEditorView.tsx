'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePersonaEditor } from '@/hooks';
import { InstructionsEditor } from './InstructionsEditor';
import { TestResponsePanel } from './TestResponsePanel';

interface PersonaEditorViewProps {
  personaId: string;
}

export function PersonaEditorView({ personaId }: PersonaEditorViewProps) {
  const {
    persona,
    instructions,
    setInstructions,
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
    loading,
    error,
  } = usePersonaEditor({ personaId });

  // Track "just saved" state for showing temporary confirmation
  const [showSaved, setShowSaved] = useState(false);
  const wasRecentlySaving = useRef(false);

  // Show "Saved" briefly after save completes, then fade it out
  useEffect(() => {
    if (isSaving) {
      wasRecentlySaving.current = true;
      setShowSaved(false);
    } else if (wasRecentlySaving.current && !isDirty) {
      // Save just completed
      wasRecentlySaving.current = false;
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSaving, isDirty]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-950">
        <div className="text-gray-500 dark:text-gray-400">Loading persona...</div>
      </div>
    );
  }

  if (error || !persona) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-gray-950">
        <div className="text-red-500 dark:text-red-400 mb-4">
          {error || 'Persona not found'}
        </div>
        <Link
          href="/"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          Return to chat
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            onClick={() => sessionStorage.setItem('refreshPersonas', 'true')}
            className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Chat
          </Link>
          <div className="h-5 w-px bg-gray-300 dark:bg-gray-600" />
          <input
            type="text"
            value={name}
            onChange={(e) => updateName(e.target.value)}
            className="text-lg font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-none focus:outline-none focus:ring-0 px-0"
          />
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-sm h-5">
          {isSaving ? (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          ) : isDirty ? (
            <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
          ) : showSaved ? (
            <span className="text-green-600 dark:text-green-400 transition-opacity duration-300">Saved</span>
          ) : null}
        </div>
      </header>

      {/* Main content - split panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Instructions editor */}
        <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <InstructionsEditor
            instructions={instructions}
            onChange={setInstructions}
            disabled={isSaving}
          />
        </div>

        {/* Right panel - Test responses */}
        <div className="w-1/2 flex flex-col">
          <TestResponsePanel
            testInputs={testInputs}
            allTestInputs={allTestInputs}
            testResponses={testResponses}
            testInputIds={persona?.testInputIds ?? []}
            generatingIds={generatingIds}
            isGenerating={isGenerating}
            onCreateTestInput={createTestInput}
            onLinkTestInput={linkTestInput}
            onRemoveTestInput={removeTestInput}
            onRegenerateSingle={regenerateSingleResponse}
            onRegenerateAll={regenerateAllResponses}
          />
        </div>
      </div>
    </div>
  );
}
