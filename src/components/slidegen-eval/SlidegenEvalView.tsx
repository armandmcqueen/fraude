'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useSlidegenEvalState, useSlidegenEvalAgent } from '@/hooks';
import { PromptEditor } from './PromptEditor';
import { TestCaseList } from './TestCaseList';
import { AgentChatPanel } from './AgentChatPanel';

export function SlidegenEvalView() {
  const {
    config,
    testCases,
    results,
    isConnected,
    error,
    updateConfig,
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Chat
          </Link>
          <span className="text-gray-400 dark:text-gray-500">/</span>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Slidegen Eval
          </h1>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 text-sm">
          {isConnected ? (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
              Connecting...
            </span>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Main content - split panels */}
      <div className="flex flex-1 overflow-hidden pb-20">
        {/* Left panel - System Prompt Editor */}
        <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <PromptEditor
            systemPrompt={config?.systemPrompt ?? null}
            onSave={updateConfig}
            isSaving={isSavingConfig}
          />
        </div>

        {/* Right panel - Test Cases */}
        <div className="w-1/2 flex flex-col">
          <TestCaseList
            testCases={testCases}
            results={results}
            isRunningTest={isRunningTest}
            isRunningAllTests={isRunningAllTests}
            onCreateTestCase={createTestCase}
            onUpdateTestCase={updateTestCase}
            onDeleteTestCase={deleteTestCase}
            onRunTest={runTest}
            onRunAllTests={runAllTests}
          />
        </div>
      </div>

      {/* Agent Chat Panel */}
      <AgentChatPanel
        turns={agentTurns}
        isLoading={isAgentLoading}
        error={agentError}
        outputImportant={agentOutputImportant}
        onSendMessage={sendAgentMessage}
        onClear={clearAgentConversation}
      />
    </div>
  );
}
