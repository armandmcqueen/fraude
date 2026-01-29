'use client';

import { useState } from 'react';
import { TestInput } from '@/types';

interface TestInputItemProps {
  testInput: TestInput;
  response?: string;
  isGenerating: boolean;
  onRemove: () => void;
  onRegenerate: () => void;
}

export function TestInputItem({
  testInput,
  response,
  isGenerating,
  onRemove,
  onRegenerate,
}: TestInputItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      {/* Test Input Header */}
      <div className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Test Input
          </div>
          <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
            {testInput.content}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 disabled:opacity-50"
            title="Regenerate response"
          >
            <svg
              className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`}
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
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
            title="Remove test input"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Response Section Header (collapsible) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Response
          </span>
          {isGenerating && (
            <svg className="w-3 h-3 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
        </div>
        {!isExpanded && response && (
          <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[400px]">
            {response.slice(0, 120)}...
          </span>
        )}
      </button>

      {/* Response Content */}
      {isExpanded && (
        <div className="px-3 pb-3">
          {isGenerating ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              Generating...
            </p>
          ) : response ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {response}
            </p>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              No response yet. Click regenerate to generate a response.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
