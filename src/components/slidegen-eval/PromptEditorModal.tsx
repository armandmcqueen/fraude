'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, History, RotateCcw, Pencil, Check } from 'lucide-react';
import { ConfigVersionSnapshot, EnhancerModel, ImageGenModel } from '@/types/slidegen-eval';
import { useDebounce } from '@/hooks';

interface PromptEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemPrompt: string | null;
  model?: EnhancerModel;
  imageModel?: ImageGenModel;
  version?: number;
  versionName?: string;
  versionHistory: ConfigVersionSnapshot[];
  onSave: (systemPrompt: string, model?: EnhancerModel, imageModel?: ImageGenModel) => Promise<void>;
  onLoadHistory: () => Promise<void>;
  onRevert: (version: number) => Promise<void>;
  onRenameVersion: (version: number, name: string) => Promise<void>;
  isSaving: boolean;
}

const MODEL_OPTIONS: { value: EnhancerModel; label: string }[] = [
  { value: 'haiku', label: 'Haiku 4.5' },
  { value: 'sonnet', label: 'Sonnet 4.5' },
  { value: 'opus', label: 'Opus 4.5' },
];

const IMAGE_MODEL_OPTIONS: { value: ImageGenModel; label: string }[] = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-3-pro', label: 'Gemini 3 Pro' },
];

export function PromptEditorModal({
  isOpen,
  onClose,
  systemPrompt,
  model,
  imageModel,
  version,
  versionName,
  versionHistory,
  onSave,
  onLoadHistory,
  onRevert,
  onRenameVersion,
  isSaving,
}: PromptEditorModalProps) {
  const [value, setValue] = useState(systemPrompt ?? '');
  const [selectedModel, setSelectedModel] = useState<EnhancerModel>(model ?? 'sonnet');
  const [selectedImageModel, setSelectedImageModel] = useState<ImageGenModel>(imageModel ?? 'gemini-3-pro');
  const [isDirty, setIsDirty] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingVersionName, setEditingVersionName] = useState<number | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const debouncedValue = useDebounce(value, 1000);
  const lastSavedRef = useRef(systemPrompt);
  const lastSavedModelRef = useRef(model);
  const lastSavedImageModelRef = useRef(imageModel);
  const wasRecentlySaving = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update local value when external prop changes
  useEffect(() => {
    if (systemPrompt !== null && systemPrompt !== lastSavedRef.current) {
      setValue(systemPrompt);
      lastSavedRef.current = systemPrompt;
      setIsDirty(false);
    }
  }, [systemPrompt]);

  // Update local model when external prop changes
  useEffect(() => {
    if (model !== undefined && model !== lastSavedModelRef.current) {
      setSelectedModel(model);
      lastSavedModelRef.current = model;
    }
  }, [model]);

  // Update local imageModel when external prop changes
  useEffect(() => {
    if (imageModel !== undefined && imageModel !== lastSavedImageModelRef.current) {
      setSelectedImageModel(imageModel);
      lastSavedImageModelRef.current = imageModel;
    }
  }, [imageModel]);

  // Auto-save when debounced value changes
  useEffect(() => {
    if (isDirty && debouncedValue !== lastSavedRef.current) {
      onSave(debouncedValue, selectedModel, selectedImageModel).then(() => {
        lastSavedRef.current = debouncedValue;
        lastSavedModelRef.current = selectedModel;
        lastSavedImageModelRef.current = selectedImageModel;
        setIsDirty(false);
      });
    }
  }, [debouncedValue, isDirty, onSave, selectedModel, selectedImageModel]);

  // Show "Saved" confirmation after save completes
  useEffect(() => {
    if (isSaving) {
      wasRecentlySaving.current = true;
      setShowSaved(false);
    } else if (wasRecentlySaving.current && !isDirty) {
      wasRecentlySaving.current = false;
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSaving, isDirty]);

  // Load history when modal opens
  useEffect(() => {
    if (isOpen) {
      onLoadHistory();
    }
  }, [isOpen, onLoadHistory]);

  // Focus textarea when modal opens (if not showing history)
  useEffect(() => {
    if (isOpen && textareaRef.current && !showHistory) {
      textareaRef.current.focus();
    }
  }, [isOpen, showHistory]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (editingVersionName !== null) {
          setEditingVersionName(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, editingVersionName]);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    setIsDirty(true);
  };

  const handleModelChange = (newModel: EnhancerModel) => {
    setSelectedModel(newModel);
    // Immediately save when model changes (no debounce needed)
    onSave(value, newModel, selectedImageModel).then(() => {
      lastSavedRef.current = value;
      lastSavedModelRef.current = newModel;
      lastSavedImageModelRef.current = selectedImageModel;
    });
  };

  const handleImageModelChange = (newImageModel: ImageGenModel) => {
    setSelectedImageModel(newImageModel);
    // Immediately save when model changes (no debounce needed)
    onSave(value, selectedModel, newImageModel).then(() => {
      lastSavedRef.current = value;
      lastSavedModelRef.current = selectedModel;
      lastSavedImageModelRef.current = newImageModel;
    });
  };

  const handleRevert = async (targetVersion: number) => {
    await onRevert(targetVersion);
    // Keep history panel open so user can see the result
  };

  const startEditingName = (ver: number, currentName: string) => {
    setEditingVersionName(ver);
    setEditNameValue(currentName);
  };

  const saveVersionName = async () => {
    if (editingVersionName !== null && editNameValue.trim()) {
      await onRenameVersion(editingVersionName, editNameValue.trim());
      setEditingVersionName(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[90vw] h-[85vh] max-w-6xl bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              System Prompt
            </h2>
            {version !== undefined && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {versionName || `v${version}`}
              </span>
            )}
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Enhancer:</span>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value as EnhancerModel)}
                disabled={isSaving}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:opacity-50 cursor-pointer"
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Image:</span>
              <select
                value={selectedImageModel}
                onChange={(e) => handleImageModelChange(e.target.value as ImageGenModel)}
                disabled={isSaving}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:opacity-50 cursor-pointer"
              >
                {IMAGE_MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status */}
            <div className="flex items-center gap-2 text-sm h-5">
              {isSaving ? (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : isDirty ? (
                <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
              ) : showSaved ? (
                <span className="text-green-600 dark:text-green-400">Saved</span>
              ) : (
                <span className="text-gray-400 dark:text-gray-500">Auto-saves on change</span>
              )}
            </div>

            {/* History toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
                showHistory
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            disabled={isSaving}
            placeholder="Enter the Prompt Enhancer system prompt..."
            className="flex-1 w-full p-6 font-mono text-sm resize-none bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-0 border-none overflow-y-auto"
          />

          {/* History sidebar */}
          {showHistory && (
            <div className="w-80 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-800/50">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Version History
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {versionHistory.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No versions yet
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {versionHistory.map((v) => {
                      const isCurrentVersion = v.version === version;
                      const hasIdenticalContent = !isCurrentVersion && v.systemPrompt === value;

                      return (
                        <div
                          key={v.version}
                          className={`p-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 ${
                            isCurrentVersion ? 'bg-gray-100 dark:bg-gray-800 border-l-2 border-gray-400 dark:border-gray-500' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            {editingVersionName === v.version ? (
                              <div className="flex items-center gap-1 flex-1 mr-2">
                                <input
                                  type="text"
                                  value={editNameValue}
                                  onChange={(e) => setEditNameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveVersionName();
                                    if (e.key === 'Escape') setEditingVersionName(null);
                                  }}
                                  className="flex-1 px-2 py-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                  autoFocus
                                />
                                <button
                                  onClick={saveVersionName}
                                  className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {v.versionName}
                                </span>
                                <button
                                  onClick={() => startEditingName(v.version, v.versionName)}
                                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                                  title="Rename"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            {isCurrentVersion ? (
                              <span className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                                Current
                              </span>
                            ) : hasIdenticalContent ? (
                              <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                                No change
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRevert(v.version)}
                                disabled={isSaving}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer disabled:opacity-50"
                                title="Revert to this version"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Revert
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(v.savedAt)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
