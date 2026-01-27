'use client';

import { useState, useCallback, KeyboardEvent } from 'react';
import { ModelSelector } from './ModelSelector';
import { expandInput } from '@/lib/test-inputs';

interface InputAreaProps {
  onSend: (content: string) => void;
  onCancel?: () => void;
  disabled: boolean;
  model: string;
  onModelChange: (model: string) => void;
  getResourceContent?: (name: string) => string | undefined;
}

export function InputArea({
  onSend,
  onCancel,
  disabled,
  model,
  onModelChange,
  getResourceContent,
}: InputAreaProps) {
  const [input, setInput] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      // Expand slash commands and @resource mentions
      const expanded = expandInput(trimmed, getResourceContent ?? (() => undefined));
      onSend(expanded);
      setInput('');
    }
  }, [input, disabled, onSend, getResourceContent]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            rows={3}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col gap-2">
          <ModelSelector
            model={model}
            onChange={onModelChange}
            disabled={disabled}
          />
          {disabled && onCancel ? (
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={disabled || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {disabled ? 'Sending...' : 'Send'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
