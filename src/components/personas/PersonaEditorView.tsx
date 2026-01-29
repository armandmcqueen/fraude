'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePersonaEditor, useAgentChat } from '@/hooks';
import { InstructionsEditor } from './InstructionsEditor';
import { TestResponsePanel } from './TestResponsePanel';
import { AgentChatInput } from './AgentChatInput';
import { AgentOutputPanel, PanelState } from './AgentOutputPanel';
import { PersonaSwitcher } from './PersonaSwitcher';

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
    refreshPersona,
    loading,
    error,
  } = usePersonaEditor({ personaId });

  // Agent chat
  const {
    turns: agentTurns,
    isLoading: isAgentLoading,
    error: agentError,
    outputImportant: agentOutputImportant,
    sendMessage: sendAgentMessage,
    clearConversation: clearAgentConversation,
    loadHistory: loadAgentHistory,
  } = useAgentChat({ personaId });

  // Panel visibility and pinned are separate states
  // Pinned persists across open/close
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wasAgentLoadingRef = useRef(false);

  // Compute panelState for AgentOutputPanel (combines visibility + pinned)
  const panelState: PanelState = !isPanelVisible ? 'hidden' : isPinned ? 'pinned' : 'visible';

  const AUTO_DISMISS_DELAY = 1000; // 1 second

  // Clear auto-dismiss timer
  const clearAutoDismissTimer = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  }, []);

  // Start auto-dismiss timer (only when visible and not pinned)
  const startAutoDismissTimer = useCallback(() => {
    clearAutoDismissTimer();
    autoDismissTimerRef.current = setTimeout(() => {
      // Only hide if still visible and not pinned
      setIsPanelVisible((visible) => {
        // Check pinned state at timer fire time
        // We can't access isPinned directly here, so we use a ref or just hide
        // The timer should only have been started if not pinned
        return false;
      });
    }, AUTO_DISMISS_DELAY);
  }, [clearAutoDismissTimer]);

  // Load agent history on mount
  useEffect(() => {
    loadAgentHistory();
  }, [loadAgentHistory]);

  // Handle agent loading state changes
  useEffect(() => {
    if (isAgentLoading) {
      // Agent started - show panel, clear any timer
      setIsPanelVisible(true);
      clearAutoDismissTimer();
    } else if (wasAgentLoadingRef.current) {
      // Agent just finished (loading went from true to false)
      // Refresh persona data to pick up any changes
      refreshPersona();

      // Start auto-dismiss timer ONLY if:
      // - Panel is not pinned
      // - Output is not marked as important
      if (!isPinned && !agentOutputImportant) {
        startAutoDismissTimer();
      }
    }
    wasAgentLoadingRef.current = isAgentLoading;
  }, [isAgentLoading, isPinned, agentOutputImportant, refreshPersona, clearAutoDismissTimer, startAutoDismissTimer]);

  // Clear timer when pinned changes to true
  useEffect(() => {
    if (isPinned) {
      clearAutoDismissTimer();
    }
  }, [isPinned, clearAutoDismissTimer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearAutoDismissTimer();
  }, [clearAutoDismissTimer]);

  // Panel actions
  const handlePanelPin = useCallback(() => {
    setIsPinned(true);
    clearAutoDismissTimer();
  }, [clearAutoDismissTimer]);

  const handlePanelClose = useCallback(() => {
    setIsPanelVisible(false);
    clearAutoDismissTimer();
  }, [clearAutoDismissTimer]);

  const handlePanelUnpin = useCallback(() => {
    // Unpin does NOT start auto-dismiss timer
    // Auto-dismiss only happens after agent finishes responding
    setIsPinned(false);
  }, []);

  const handleTogglePanel = useCallback(() => {
    // Toggle visibility, preserve pinned state
    setIsPanelVisible((v) => !v);
  }, []);

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
          <div className="flex items-center gap-1">
            <PersonaSwitcher currentPersonaId={personaId} currentPersonaName={name} />
            <input
              type="text"
              value={name}
              onChange={(e) => updateName(e.target.value)}
              className="text-lg font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-none focus:outline-none focus:ring-0 px-0"
            />
          </div>
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
      <div className="flex flex-1 overflow-hidden pb-20">
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

      {/* Agent output panel */}
      <AgentOutputPanel
        turns={agentTurns}
        panelState={panelState}
        outputImportant={agentOutputImportant}
        onPin={handlePanelPin}
        onUnpin={handlePanelUnpin}
        onClose={handlePanelClose}
        onClear={clearAgentConversation}
        error={agentError}
        isLoading={isAgentLoading}
      />

      {/* Agent chat input */}
      <AgentChatInput
        onSend={sendAgentMessage}
        isLoading={isAgentLoading}
        onTogglePanel={handleTogglePanel}
        isPanelVisible={isPanelVisible}
        hasHistory={agentTurns.length > 0}
      />
    </div>
  );
}
