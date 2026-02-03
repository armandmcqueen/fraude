'use client';

import { useState } from 'react';
import { PlayCircle, Plus, Loader2 } from 'lucide-react';
import { EvalTestCase, EvalTestResult } from '@/types/slidegen-eval';
import { TestCaseItem } from './TestCaseItem';

interface TestCaseListProps {
  testCases: EvalTestCase[];
  results: Map<string, EvalTestResult>;
  isRunningTest: string | null;
  isRunningAllTests: boolean;
  onCreateTestCase: (name: string, inputText: string) => Promise<EvalTestCase>;
  onUpdateTestCase: (id: string, updates: { name?: string; inputText?: string }) => Promise<void>;
  onDeleteTestCase: (id: string) => Promise<void>;
  onRunTest: (testCaseId: string) => Promise<void>;
  onRunAllTests: () => Promise<void>;
}

export function TestCaseList({
  testCases,
  results,
  isRunningTest,
  isRunningAllTests,
  onCreateTestCase,
  onUpdateTestCase,
  onDeleteTestCase,
  onRunTest,
  onRunAllTests,
}: TestCaseListProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInputText, setNewInputText] = useState('');

  const handleCreate = async () => {
    if (!newName.trim() || !newInputText.trim()) return;

    try {
      await onCreateTestCase(newName.trim(), newInputText.trim());
      setNewName('');
      setNewInputText('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create test case:', error);
    }
  };

  const handleCancel = () => {
    setNewName('');
    setNewInputText('');
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Test Cases ({testCases.length})
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onRunAllTests}
            disabled={isRunningAllTests || testCases.length === 0}
            className="p-1.5 text-green-500 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={isRunningAllTests ? 'Running all tests...' : 'Run all tests'}
          >
            {isRunningAllTests ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <PlayCircle className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => setIsCreating(true)}
            disabled={isCreating}
            className="p-1.5 text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Add test case"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Create new form */}
        {isCreating && (
          <div className="border border-blue-300 dark:border-blue-700 rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Marketing Slide"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Input Text
                </label>
                <textarea
                  value={newInputText}
                  onChange={(e) => setNewInputText(e.target.value)}
                  placeholder="The raw slide content to test..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || !newInputText.trim()}
                  className="px-3 py-1 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test case list */}
        {testCases.length === 0 && !isCreating ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No test cases yet. Click "Add Test Case" to create one.
          </div>
        ) : (
          testCases.map((testCase) => (
            <TestCaseItem
              key={testCase.id}
              testCase={testCase}
              result={results.get(testCase.id) ?? null}
              isRunning={isRunningTest === testCase.id}
              onRun={() => onRunTest(testCase.id)}
              onUpdate={(updates) => onUpdateTestCase(testCase.id, updates)}
              onDelete={() => onDeleteTestCase(testCase.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
