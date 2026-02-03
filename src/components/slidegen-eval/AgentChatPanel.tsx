'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SlidegenEvalAgentTurn } from '@/types/slidegen-eval';
import { MarkdownContent } from '@/components/ui/MarkdownContent';

interface AgentChatPanelProps {
  turns: SlidegenEvalAgentTurn[];
  isLoading: boolean;
  error: string | null;
  outputImportant: boolean;
  onSendMessage: (message: string) => void;
  onClear: () => void;
}

export function AgentChatPanel({
  turns,
  isLoading,
  error,
  outputImportant,
  onSendMessage,
  onClear,
}: AgentChatPanelProps) {
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasLoadingRef = useRef(false);
  const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  const AUTO_DISMISS_DELAY = 1000;

  // Clear auto-dismiss timer
  const clearAutoDismissTimer = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  }, []);

  // Start auto-dismiss timer
  const startAutoDismissTimer = useCallback(() => {
    clearAutoDismissTimer();
    autoDismissTimerRef.current = setTimeout(() => {
      setIsPanelVisible(false);
    }, AUTO_DISMISS_DELAY);
  }, [clearAutoDismissTimer]);

  // Handle loading state changes
  useEffect(() => {
    if (isLoading) {
      setIsPanelVisible(true);
      clearAutoDismissTimer();
    } else if (wasLoadingRef.current) {
      if (!isPinned && !outputImportant) {
        startAutoDismissTimer();
      }
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, isPinned, outputImportant, clearAutoDismissTimer, startAutoDismissTimer]);

  // Clear timer when pinned
  useEffect(() => {
    if (isPinned) {
      clearAutoDismissTimer();
    }
  }, [isPinned, clearAutoDismissTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAutoDismissTimer();
  }, [clearAutoDismissTimer]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && isPanelVisible) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, isPanelVisible]);

  // Handle click outside
  useEffect(() => {
    const shouldHandleClickOutside = isPinned || (isPanelVisible && outputImportant);
    if (!shouldHandleClickOutside) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const inputArea = document.querySelector('[data-agent-input]');
        if (inputArea?.contains(e.target as Node)) return;
        setIsPanelVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPanelVisible, isPinned, outputImportant]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePin = () => {
    setIsPinned(true);
    clearAutoDismissTimer();
  };

  const handleClose = () => {
    setIsPanelVisible(false);
    clearAutoDismissTimer();
  };

  const handleTogglePanel = () => {
    setIsPanelVisible((v) => !v);
  };

  return (
    <>
      {/* Output Panel */}
      {isPanelVisible && (
        <>
          {/* Backdrop for expanded mode */}
          {isExpanded && (
            <div className="fixed inset-0 bg-black/30 z-30" onClick={handleClose} />
          )}
          <div className={`fixed z-30 px-4 pointer-events-none ${
            isExpanded ? 'inset-4 bottom-20' : 'bottom-20 left-0 right-0'
          }`}>
            <div className={`pointer-events-auto h-full ${isExpanded ? '' : 'max-w-4xl mx-auto'}`} ref={panelRef}>
              <div
                className={`bg-white dark:bg-gray-900 rounded-xl shadow-2xl border flex flex-col transition-all duration-200 ${
                  isExpanded ? 'h-full' : 'max-h-96'
                } ${
                  isPinned
                    ? 'border-blue-300 dark:border-blue-700 ring-2 ring-blue-200 dark:ring-blue-800'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
                onClick={() => { if (!isPinned) handlePin(); }}
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
                        onClick={(e) => { e.stopPropagation(); setIsPinned(false); }}
                        className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                      >
                        Pinned
                      </button>
                    )}
                    {!isPinned && !isLoading && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">Click to pin</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onClear(); }}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Clear
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                      className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
                    >
                      {isExpanded ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleClose(); }}
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
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <span className="text-sm font-medium text-red-700 dark:text-red-400">Error: </span>
                      <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
                    </div>
                  )}

                  {turns.length === 0 && !error && (
                    <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                      No messages yet. Ask the AI to help iterate on the prompt.
                    </div>
                  )}

                  {turns.map((turn) => (
                    <TurnDisplay key={turn.id} turn={turn} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Input Area */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 z-40"
        data-agent-input
      >
        <div className="max-w-4xl mx-auto flex items-end gap-3">
          {turns.length > 0 && (
            <button
              onClick={handleTogglePanel}
              className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isPanelVisible ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                )}
              </svg>
            </button>
          )}

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the AI to help iterate on the prompt..."
              disabled={isLoading}
              rows={1}
              className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function TurnDisplay({ turn }: { turn: SlidegenEvalAgentTurn }) {
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
