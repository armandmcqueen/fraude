'use client';

import { useState, useRef, useEffect } from 'react';
import { TestInput, TestInputSummary } from '@/types';
import { TestInputItem } from './TestInputItem';

interface TestResponsePanelProps {
  testInputs: Map<string, TestInput>;
  allTestInputs: TestInputSummary[];
  testResponses: Map<string, string>;
  testInputIds: string[];
  generatingIds: Set<string>;
  isGenerating: boolean;
  onCreateTestInput: (content: string) => Promise<unknown>;
  onLinkTestInput: (id: string) => Promise<void>;
  onRemoveTestInput: (id: string) => void;
  onRegenerateSingle: (id: string) => void;
  onRegenerateAll: () => void;
}

export function TestResponsePanel({
  testInputs,
  allTestInputs,
  testResponses,
  testInputIds,
  generatingIds,
  isGenerating,
  onCreateTestInput,
  onLinkTestInput,
  onRemoveTestInput,
  onRegenerateSingle,
  onRegenerateAll,
}: TestResponsePanelProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newInputContent, setNewInputContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setIsCreating(false);
        setNewInputContent('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreate = async () => {
    if (!newInputContent.trim()) return;

    setIsAdding(true);
    try {
      await onCreateTestInput(newInputContent.trim());
      setNewInputContent('');
      // Stay in create mode for quick multiple additions
    } finally {
      setIsAdding(false);
    }
  };

  const handleLink = async (id: string) => {
    setIsAdding(true);
    try {
      await onLinkTestInput(id);
      // Keep dropdown open for quick multiple additions
    } finally {
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCreate();
    }
    if (e.key === 'Escape') {
      setIsCreating(false);
      setNewInputContent('');
    }
  };

  // Filter out test inputs that are already linked to this persona
  const availableTestInputs = allTestInputs.filter(
    (input) => !testInputIds.includes(input.id)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Test Responses
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            See how your persona responds to sample inputs
          </p>
        </div>
        <div className="flex items-center gap-2">
          {testInputIds.length > 0 && (
            <button
              onClick={() => onRegenerateAll()}
              disabled={isGenerating}
              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
            >
              <svg
                className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Regenerate All
            </button>
          )}

          {/* Add button with dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>

            {/* Dropdown menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                {isCreating ? (
                  <div className="p-3">
                    <textarea
                      value={newInputContent}
                      onChange={(e) => setNewInputContent(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter test message..."
                      rows={3}
                      disabled={isAdding}
                      autoFocus
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setIsCreating(false);
                            setNewInputContent('');
                          }}
                          disabled={isAdding}
                          className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreate}
                          disabled={isAdding || !newInputContent.trim()}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isAdding ? 'Adding...' : 'Create'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Create new option */}
                    <button
                      onClick={() => setIsCreating(true)}
                      className="w-full px-3 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create new test input
                    </button>

                    {/* Existing test inputs */}
                    {availableTestInputs.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto">
                        {availableTestInputs.map((input) => (
                          <button
                            key={input.id}
                            onClick={() => handleLink(input.id)}
                            disabled={isAdding}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                          >
                            <span className="line-clamp-2">{input.content}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
                        No other test inputs available
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Test Inputs List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {testInputIds.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">No test inputs yet.</p>
            <p className="text-xs mt-1">Click &quot;Add&quot; to create or select a test input.</p>
          </div>
        ) : (
          testInputIds.map((id) => {
            const testInput = testInputs.get(id);
            if (!testInput) return null;

            return (
              <TestInputItem
                key={id}
                testInput={testInput}
                response={testResponses.get(id)}
                isGenerating={generatingIds.has(id)}
                onRemove={() => onRemoveTestInput(id)}
                onRegenerate={() => onRegenerateSingle(id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
