'use client';

import { useEffect, useRef } from 'react';
import { AgentTurn } from '@/types';
import { MarkdownContent } from '@/components/ui/MarkdownContent';

export type PanelState = 'hidden' | 'visible' | 'pinned';

interface AgentOutputPanelProps {
  turns: AgentTurn[];
  panelState: PanelState;
  onPin: () => void;
  onUnpin: () => void;
  onClose: () => void;
  onClear: () => void;
  error: string | null;
  isLoading: boolean;
}

export function AgentOutputPanel({
  turns,
  panelState,
  onPin,
  onUnpin,
  onClose,
  onClear,
  error,
  isLoading,
}: AgentOutputPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new turns arrive
  useEffect(() => {
    if (scrollRef.current && panelState !== 'hidden') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, panelState]);

  // Handle click outside to close pinned panel
  useEffect(() => {
    if (panelState !== 'pinned') return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Check if click was on the input area (don't close in that case)
        const inputArea = document.querySelector('[data-agent-input]');
        if (inputArea?.contains(e.target as Node)) return;
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelState, onClose]);

  if (panelState === 'hidden') return null;

  const isPinned = panelState === 'pinned';

  return (
    <div className="fixed bottom-20 left-0 right-0 z-30 px-4 pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto" ref={panelRef}>
        <div
          className={`bg-white dark:bg-gray-900 rounded-xl shadow-2xl border max-h-96 flex flex-col transition-all duration-200 ${
            isPinned
              ? 'border-blue-300 dark:border-blue-700 ring-2 ring-blue-200 dark:ring-blue-800'
              : 'border-gray-200 dark:border-gray-700'
          }`}
          onClick={() => {
            if (!isPinned) onPin();
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Agent Output
              </span>
              {isLoading && (
                <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {isPinned && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnpin();
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  title="Click to unpin"
                >
                  Pinned
                </button>
              )}
              {!isPinned && !isLoading && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Click to pin
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {turns.length === 0 && !error && (
              <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                No messages yet. Ask the AI to help edit this persona.
              </div>
            )}

            {turns.map((turn) => (
              <TurnDisplay key={turn.id} turn={turn} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TurnDisplay({ turn }: { turn: AgentTurn }) {
  switch (turn.type) {
    case 'user':
      return (
        <div className="flex justify-end">
          <div className="max-w-[80%] px-4 py-2 rounded-2xl bg-blue-600 text-white">
            <p className="text-sm whitespace-pre-wrap">{turn.content}</p>
          </div>
        </div>
      );

    case 'assistant_text':
      return (
        <div className="flex justify-start">
          <div className="max-w-[80%] px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <MarkdownContent content={turn.content} className="text-sm" />
          </div>
        </div>
      );

    case 'tool_call':
      return (
        <div className="flex justify-start">
          <div className="max-w-[80%] px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium">{turn.toolName}</span>
            </div>
          </div>
        </div>
      );

    case 'tool_result':
      return (
        <div className="flex justify-start">
          <div className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${
            turn.isError
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
              : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
          }`}>
            <pre className="whitespace-pre-wrap font-mono">{turn.output}</pre>
          </div>
        </div>
      );

    default:
      return null;
  }
}
