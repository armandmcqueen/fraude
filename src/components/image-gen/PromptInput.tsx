'use client';

import { useState, useCallback, useEffect, useRef, KeyboardEvent } from 'react';
import { IMAGE_GEN_STORAGE_KEYS } from '@/hooks/useImageGeneration';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  isSlideMode?: boolean;
}

export function PromptInput({ onSubmit, disabled, isSlideMode }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem(IMAGE_GEN_STORAGE_KEYS.draft);
      if (draft) {
        setPrompt(draft);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save draft to localStorage on change
  const handleChange = useCallback((value: string) => {
    setPrompt(value);
    try {
      localStorage.setItem(IMAGE_GEN_STORAGE_KEYS.draft, value);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
    }
  }, [prompt]);

  const handleSubmit = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setPrompt('');
    // Clear draft from localStorage
    try {
      localStorage.removeItem(IMAGE_GEN_STORAGE_KEYS.draft);
    } catch {
      // Ignore storage errors
    }
  }, [prompt, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex gap-2 items-end">
      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isSlideMode
          ? "Enter your slide content (AI will create the image prompt)..."
          : "Describe the image you want to generate..."}
        disabled={disabled}
        rows={2}
        className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed min-h-[60px] max-h-[300px]"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !prompt.trim()}
        className="px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed self-end"
      >
        {disabled ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
