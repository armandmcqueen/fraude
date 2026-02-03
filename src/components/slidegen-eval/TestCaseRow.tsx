'use client';

import { useState } from 'react';
import { Play, Pencil, Trash2, Check, X, Loader2, Copy, Expand } from 'lucide-react';
import { EvalTestCase, EvalTestResult } from '@/types/slidegen-eval';
import { TestCaseEditModal } from './TestCaseEditModal';

interface TestCaseRowProps {
  testCase: EvalTestCase;
  result: EvalTestResult | null;
  currentConfigVersion: number | undefined;
  isRunning: boolean;
  showEnhancedPrompt: boolean;
  onRun: () => void;
  onUpdate: (updates: { name?: string; inputText?: string }) => Promise<void>;
  onDelete: () => Promise<void>;
  onOpenImage: () => void;
}

export function TestCaseRow({
  testCase,
  result,
  currentConfigVersion,
  isRunning,
  showEnhancedPrompt,
  onRun,
  onUpdate,
  onDelete,
  onOpenImage,
}: TestCaseRowProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = async () => {
    if (result?.enhancedPrompt) {
      await navigator.clipboard.writeText(result.enhancedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const getStatusBadge = () => {
    if (!result) return null;

    switch (result.status) {
      case 'pending':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            Pending
          </span>
        );
      case 'enhancing':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Enhancing
          </span>
        );
      case 'generating_image':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating
          </span>
        );
      case 'complete': {
        const isOutdated = currentConfigVersion !== undefined && result.configVersion !== currentConfigVersion;
        if (isOutdated) {
          return (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              Outdated
            </span>
          );
        }
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
            Complete
          </span>
        );
      }
      case 'error':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            Error
          </span>
        );
    }
  };

  // Image height determines the max height of the input section
  const ROW_HEIGHT = 200;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* Main row content */}
      <div className="flex items-stretch" style={{ minHeight: ROW_HEIGHT }}>
        {/* Input section - constrained to image height */}
        <div
          className="w-56 flex-shrink-0 p-4 border-r border-gray-200 dark:border-gray-700 flex flex-col justify-center"
          style={{ maxHeight: ROW_HEIGHT }}
        >
          {/* Title */}
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            {testCase.name}
          </h3>

          {/* Status badge */}
          <div className="mb-2 flex-shrink-0">
            {getStatusBadge()}
          </div>

          {/* Truncated input text with hover to see full */}
          <p
            className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2"
            title={testCase.inputText}
          >
            {testCase.inputText}
          </p>
        </div>

        {/* Actions - between input and image */}
        <div className="flex flex-col justify-center items-center gap-1 p-2 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 w-14">
          {!showDeleteConfirm && (
            <button
              onClick={onRun}
              disabled={isRunning}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={isRunning ? 'Running...' : 'Run test'}
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
          )}
          {showDeleteConfirm ? (
            <>
              <span className="text-xs font-medium text-red-500 dark:text-red-400 px-1">
                Delete?
              </span>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="p-1.5 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Confirm delete"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer disabled:opacity-50"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowEditModal(true)}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={handleDeleteClick}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Output section - expands to fill available space */}
        <div className="flex-1 flex items-stretch min-w-0">
          {/* Image container */}
          <div
            className={`p-4 flex items-center justify-center ${
              showEnhancedPrompt && result?.enhancedPrompt ? 'w-80 flex-shrink-0' : 'flex-1'
            }`}
          >
            {result?.generatedImageId ? (
              <button
                onClick={onOpenImage}
                className="relative cursor-pointer"
              >
                <img
                  src={`/api/images/${result.generatedImageId}`}
                  alt="Generated slide"
                  className="max-w-full rounded border border-gray-200 dark:border-gray-700 object-contain"
                  style={{ maxHeight: ROW_HEIGHT - 32 }}
                />
                {/* Small expand icon in corner */}
                <div className="absolute bottom-1 right-1 bg-black/40 hover:bg-black/60 rounded p-1 transition-colors">
                  <Expand className="w-3 h-3 text-white" />
                </div>
              </button>
            ) : result?.imageError ? (
              <div className="text-center max-w-md">
                <span className="text-sm font-medium text-red-500 dark:text-red-400">Error</span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-3">
                  {result.imageError}
                </p>
              </div>
            ) : result?.status === 'enhancing' || result?.status === 'generating_image' ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {result.status === 'enhancing' ? 'Enhancing prompt...' : 'Generating image...'}
                </span>
              </div>
            ) : (
              <span className="text-sm text-gray-400 dark:text-gray-500">No image yet</span>
            )}
          </div>

          {/* Enhanced prompt section - shown when expanded */}
          {showEnhancedPrompt && result?.enhancedPrompt && (
            <div
              className="flex-1 p-4 flex flex-col min-w-0 border-l border-gray-200 dark:border-gray-700"
              style={{ maxHeight: ROW_HEIGHT }}
            >
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Enhanced Prompt
                  </h4>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    (v{result.configVersion})
                  </span>
                </div>
                <button
                  onClick={handleCopyPrompt}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer"
                  title={copied ? 'Copied!' : 'Copy to clipboard'}
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-y-auto flex-1">
                {result.enhancedPrompt}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error details - show below if there's an error */}
      {result?.imageError && !result.generatedImageId && (
        <div className="border-t border-red-200 dark:border-red-800 p-4 bg-red-50 dark:bg-red-900/10">
          <h4 className="text-xs font-medium text-red-500 dark:text-red-400 mb-1">Error Details</h4>
          <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
            {result.imageError}
          </p>
        </div>
      )}

      {/* Edit modal */}
      {showEditModal && (
        <TestCaseEditModal
          testCase={testCase}
          onClose={() => setShowEditModal(false)}
          onSave={onUpdate}
        />
      )}
    </div>
  );
}
