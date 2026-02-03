'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, PlayCircle, Plus, Loader2, FileText, ScrollText } from 'lucide-react';
import { useSlidegenEvalState, useSlidegenEvalAgent } from '@/hooks';
import { PromptEditorModal } from './PromptEditorModal';
import { TestCaseList } from './TestCaseList';
import { AgentChatPanel } from './AgentChatPanel';

export function SlidegenEvalView() {
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [showEnhancedPrompts, setShowEnhancedPrompts] = useState(false);
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  const {
    config,
    versionHistory,
    testCases,
    results,
    error,
    updateConfig,
    loadVersionHistory,
    revertToVersion,
    renameVersion,
    createTestCase,
    updateTestCase,
    deleteTestCase,
    runTest,
    runAllTests,
    isSavingConfig,
    isRunningTest,
    isRunningAllTests,
  } = useSlidegenEvalState();

  const {
    turns: agentTurns,
    isLoading: isAgentLoading,
    error: agentError,
    outputImportant: agentOutputImportant,
    sendMessage: sendAgentMessage,
    clearConversation: clearAgentConversation,
    loadHistory: loadAgentHistory,
  } = useSlidegenEvalAgent();

  // Load agent history on mount
  useEffect(() => {
    loadAgentHistory();
  }, [loadAgentHistory]);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Chat
          </Link>
          <span className="text-gray-400 dark:text-gray-500">/</span>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Slidegen Eval
          </h1>
        </div>

        <div className="flex items-center gap-1">
          {/* Show Enhanced Prompts toggle */}
          <button
            onClick={() => setShowEnhancedPrompts(!showEnhancedPrompts)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors cursor-pointer text-sm ${
              showEnhancedPrompts
                ? 'text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-gray-700'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={showEnhancedPrompts ? 'Hide enhanced prompts' : 'Show enhanced prompts'}
          >
            <FileText className="w-4 h-4" />
            <span>Prompts</span>
          </button>

          {/* Add Test button */}
          <button
            onClick={() => setIsCreatingTest(true)}
            disabled={isCreatingTest}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Add test case"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Run All button */}
          <button
            onClick={runAllTests}
            disabled={isRunningAllTests || testCases.length === 0}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={isRunningAllTests ? 'Running all tests...' : 'Run all tests'}
          >
            {isRunningAllTests ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <PlayCircle className="w-5 h-5" />
            )}
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2" />

          {/* Edit System Prompt button */}
          <button
            onClick={() => setIsPromptModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
          >
            <ScrollText className="w-4 h-4" />
            <span>System Prompt</span>
            {config && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                ({config.versionName})
              </span>
            )}
          </button>

        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Main content - Test Cases (full width) */}
      <div className={`flex-1 overflow-hidden ${isChatMinimized ? 'pb-0' : 'pb-20'}`}>
        <TestCaseList
          testCases={testCases}
          results={results}
          currentConfigVersion={config?.version}
          isRunningTest={isRunningTest}
          showEnhancedPrompts={showEnhancedPrompts}
          isCreating={isCreatingTest}
          onSetIsCreating={setIsCreatingTest}
          onCreateTestCase={createTestCase}
          onUpdateTestCase={updateTestCase}
          onDeleteTestCase={deleteTestCase}
          onRunTest={runTest}
        />
      </div>

      {/* Agent Chat Panel */}
      <AgentChatPanel
        turns={agentTurns}
        isLoading={isAgentLoading}
        error={agentError}
        outputImportant={agentOutputImportant}
        isMinimized={isChatMinimized}
        onMinimizedChange={setIsChatMinimized}
        onSendMessage={sendAgentMessage}
        onClear={clearAgentConversation}
      />

      {/* System Prompt Modal */}
      <PromptEditorModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        systemPrompt={config?.systemPrompt ?? null}
        model={config?.model}
        imageModel={config?.imageModel}
        version={config?.version}
        versionName={config?.versionName}
        versionHistory={versionHistory}
        onSave={updateConfig}
        onLoadHistory={loadVersionHistory}
        onRevert={revertToVersion}
        onRenameVersion={renameVersion}
        isSaving={isSavingConfig}
      />
    </div>
  );
}
