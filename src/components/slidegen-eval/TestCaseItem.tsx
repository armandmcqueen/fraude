'use client';

import { useState } from 'react';
import { Play, Pencil, Trash2, Check, X, ChevronRight, Loader2 } from 'lucide-react';
import { EvalTestCase, EvalTestResult } from '@/types/slidegen-eval';

interface TestCaseItemProps {
  testCase: EvalTestCase;
  result: EvalTestResult | null;
  isRunning: boolean;
  onRun: () => void;
  onUpdate: (updates: { name?: string; inputText?: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function TestCaseItem({
  testCase,
  result,
  isRunning,
  onRun,
  onUpdate,
  onDelete,
}: TestCaseItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(testCase.name);
  const [editInputText, setEditInputText] = useState(testCase.inputText);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    await onUpdate({ name: editName, inputText: editInputText });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(testCase.name);
    setEditInputText(testCase.inputText);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusDisplay = () => {
    if (!result) return null;

    switch (result.status) {
      case 'pending':
        return <span className="text-gray-500 dark:text-gray-400">Pending</span>;
      case 'enhancing':
        return (
          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Enhancing...
          </span>
        );
      case 'generating_image':
        return (
          <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating image...
          </span>
        );
      case 'complete':
        return <span className="text-green-600 dark:text-green-400">✓ Complete</span>;
      case 'error':
        return <span className="text-red-600 dark:text-red-400">✗ Error</span>;
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750"
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        <button
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>

        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 px-2 py-1 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
            {testCase.name}
          </span>
        )}

        <div className="text-xs">
          {getStatusDisplay()}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onRun}
            disabled={isRunning}
            className="p-1.5 text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={isRunning ? 'Running...' : 'Run test'}
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="p-1.5 text-green-500 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors cursor-pointer"
                title="Save"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancel}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-3 space-y-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          {/* Input text */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Input Text</h4>
            {isEditing ? (
              <textarea
                value={editInputText}
                onChange={(e) => setEditInputText(e.target.value)}
                rows={3}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
              />
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {testCase.inputText}
              </p>
            )}
          </div>

          {/* Result */}
          {result && (
            <>
              {/* Enhanced Prompt */}
              {result.enhancedPrompt && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Enhanced Prompt (Config v{result.configVersion})
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    {result.enhancedPrompt}
                  </p>
                </div>
              )}

              {/* Generated Image */}
              {result.generatedImageId && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Generated Image
                  </h4>
                  <img
                    src={`/api/images/${result.generatedImageId}`}
                    alt="Generated slide"
                    className="max-w-full h-auto rounded border border-gray-200 dark:border-gray-700"
                  />
                </div>
              )}

              {/* Error */}
              {result.imageError && (
                <div>
                  <h4 className="text-xs font-medium text-red-500 dark:text-red-400 mb-1">Error</h4>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {result.imageError}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
