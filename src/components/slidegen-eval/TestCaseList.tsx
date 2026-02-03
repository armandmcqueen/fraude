'use client';

import { useState, useMemo } from 'react';
import { EvalTestCase, EvalTestResult } from '@/types/slidegen-eval';
import { TestCaseRow } from './TestCaseRow';
import { ImageModal } from './ImageModal';

interface TestCaseListProps {
  testCases: EvalTestCase[];
  results: Map<string, EvalTestResult>;
  currentConfigVersion: number | undefined;
  isRunningTest: string | null;
  showEnhancedPrompts: boolean;
  isCreating: boolean;
  onSetIsCreating: (isCreating: boolean) => void;
  onCreateTestCase: (name: string, inputText: string) => Promise<EvalTestCase>;
  onUpdateTestCase: (id: string, updates: { name?: string; inputText?: string }) => Promise<void>;
  onDeleteTestCase: (id: string) => Promise<void>;
  onRunTest: (testCaseId: string) => Promise<void>;
}

export function TestCaseList({
  testCases,
  results,
  currentConfigVersion,
  isRunningTest,
  showEnhancedPrompts,
  isCreating,
  onSetIsCreating,
  onCreateTestCase,
  onUpdateTestCase,
  onDeleteTestCase,
  onRunTest,
}: TestCaseListProps) {
  const [newName, setNewName] = useState('');
  const [newInputText, setNewInputText] = useState('');
  const [viewingImageTestCaseId, setViewingImageTestCaseId] = useState<string | null>(null);

  // Get list of test cases that have images, for navigation
  const testCasesWithImages = useMemo(() => {
    return testCases.filter((tc) => results.get(tc.id)?.generatedImageId);
  }, [testCases, results]);

  const currentImageIndex = useMemo(() => {
    if (!viewingImageTestCaseId) return -1;
    return testCasesWithImages.findIndex((tc) => tc.id === viewingImageTestCaseId);
  }, [viewingImageTestCaseId, testCasesWithImages]);

  const handlePreviousImage = () => {
    if (currentImageIndex > 0) {
      setViewingImageTestCaseId(testCasesWithImages[currentImageIndex - 1].id);
    }
  };

  const handleNextImage = () => {
    if (currentImageIndex < testCasesWithImages.length - 1) {
      setViewingImageTestCaseId(testCasesWithImages[currentImageIndex + 1].id);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newInputText.trim()) return;

    try {
      await onCreateTestCase(newName.trim(), newInputText.trim());
      setNewName('');
      setNewInputText('');
      onSetIsCreating(false);
    } catch (error) {
      console.error('Failed to create test case:', error);
    }
  };

  const handleCancel = () => {
    setNewName('');
    setNewInputText('');
    onSetIsCreating(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Create new form */}
        {isCreating && (
          <div className="border border-blue-300 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              New Test Case
            </h3>
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
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || !newInputText.trim()}
                  className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test case rows */}
        {testCases.length === 0 && !isCreating ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="mb-2">No test cases yet.</p>
            <button
              onClick={() => onSetIsCreating(true)}
              className="text-gray-900 dark:text-gray-100 hover:underline cursor-pointer"
            >
              Create your first test case
            </button>
          </div>
        ) : (
          <div className={`grid gap-4 ${showEnhancedPrompts ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2'}`}>
            {testCases.map((testCase) => (
              <TestCaseRow
                key={testCase.id}
                testCase={testCase}
                result={results.get(testCase.id) ?? null}
                currentConfigVersion={currentConfigVersion}
                isRunning={isRunningTest === testCase.id}
                showEnhancedPrompt={showEnhancedPrompts}
                onRun={() => onRunTest(testCase.id)}
                onUpdate={(updates) => onUpdateTestCase(testCase.id, updates)}
                onDelete={() => onDeleteTestCase(testCase.id)}
                onOpenImage={() => setViewingImageTestCaseId(testCase.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Image modal */}
      {viewingImageTestCaseId && results.get(viewingImageTestCaseId)?.generatedImageId && (
        <ImageModal
          imageId={results.get(viewingImageTestCaseId)!.generatedImageId!}
          onClose={() => setViewingImageTestCaseId(null)}
          onPrevious={currentImageIndex > 0 ? handlePreviousImage : null}
          onNext={currentImageIndex < testCasesWithImages.length - 1 ? handleNextImage : null}
        />
      )}
    </div>
  );
}
