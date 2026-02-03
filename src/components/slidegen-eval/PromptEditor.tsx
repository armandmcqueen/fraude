'use client';

import { useState, useEffect, useRef } from 'react';
import { useDebounce } from '@/hooks';

interface PromptEditorProps {
  systemPrompt: string | null;
  onSave: (systemPrompt: string) => Promise<void>;
  isSaving: boolean;
}

export function PromptEditor({ systemPrompt, onSave, isSaving }: PromptEditorProps) {
  const [value, setValue] = useState(systemPrompt ?? '');
  const [isDirty, setIsDirty] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const debouncedValue = useDebounce(value, 1000);
  const lastSavedRef = useRef(systemPrompt);
  const wasRecentlySaving = useRef(false);

  // Update local value when external prop changes
  useEffect(() => {
    if (systemPrompt !== null && systemPrompt !== lastSavedRef.current) {
      setValue(systemPrompt);
      lastSavedRef.current = systemPrompt;
      setIsDirty(false);
    }
  }, [systemPrompt]);

  // Auto-save when debounced value changes
  useEffect(() => {
    if (isDirty && debouncedValue !== lastSavedRef.current) {
      onSave(debouncedValue).then(() => {
        lastSavedRef.current = debouncedValue;
        setIsDirty(false);
      });
    }
  }, [debouncedValue, isDirty, onSave]);

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

  const handleChange = (newValue: string) => {
    setValue(newValue);
    setIsDirty(true);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          System Prompt
        </h2>
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
      </div>
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isSaving}
        placeholder="Enter the Prompt Enhancer system prompt..."
        className="flex-1 w-full p-4 font-mono text-sm resize-none bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-0 border-none"
      />
    </div>
  );
}
