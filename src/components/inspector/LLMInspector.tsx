'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { LLMCallRecord } from '@/lib/llm-recorder';

interface LLMCallSummary {
  id: string;
  conversationId: string;
  filename: string;
  callType: string;
  model: string;
  timestamp: string;
  latencyMs: number;
  hasError: boolean;
}

interface LLMInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  onCopy?: () => void;
  copyLabel?: string;
}

function CollapsibleSection({ title, defaultOpen = false, children, onCopy, copyLabel }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">{title}</h3>
        </div>
        {onCopy && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            className="text-xs text-blue-500 hover:text-blue-600 cursor-pointer"
          >
            {copyLabel}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="p-3 bg-white dark:bg-gray-800/50">
          {children}
        </div>
      )}
    </section>
  );
}

export function LLMInspector({ isOpen, onClose, conversationId }: LLMInspectorProps) {
  const [calls, setCalls] = useState<LLMCallSummary[]>([]);
  const [selectedCall, setSelectedCall] = useState<LLMCallRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Fetch call list for this conversation
  const fetchCalls = useCallback(async () => {
    try {
      const response = await fetch('/api/llm-calls');
      if (response.ok) {
        const data: LLMCallSummary[] = await response.json();
        // Filter to only show calls for this conversation
        const filtered = data.filter((call) => call.conversationId === conversationId);
        setCalls(filtered);
      }
    } catch (error) {
      console.error('Failed to fetch LLM calls:', error);
    }
  }, [conversationId]);

  // Fetch on open or when conversationId changes
  useEffect(() => {
    if (isOpen) {
      fetchCalls();
      setSelectedCall(null); // Clear selection when conversation changes
    }
  }, [isOpen, fetchCalls]);

  // Load a specific call
  const loadCall = async (summary: LLMCallSummary) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/llm-calls/${summary.conversationId}/${summary.filename}`
      );
      if (response.ok) {
        const data = await response.json();
        setSelectedCall(data);
      }
    } catch (error) {
      console.error('Failed to load LLM call:', error);
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[500px] bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold">LLM Call Inspector</h2>
        <div className="flex gap-2">
          <button
            onClick={fetchCalls}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Refresh"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Call List */}
        <div className="w-48 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          {calls.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No recordings yet</p>
          ) : (
            calls.map((call) => (
              <button
                key={call.id}
                onClick={() => loadCall(call)}
                className={`w-full p-3 text-left border-b border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  selectedCall?.id === call.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    call.callType === 'chat'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  }`}>
                    {call.callType}
                  </span>
                  {call.hasError && (
                    <span className="text-xs text-red-500">!</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatTime(call.timestamp)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {call.latencyMs}ms
                </div>
              </button>
            ))
          )}
        </div>

        {/* Call Details */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : selectedCall ? (
            <div className="space-y-3">
              {/* Last User Message - expanded by default */}
              <CollapsibleSection
                title="User Message"
                defaultOpen={true}
                onCopy={() => copyToClipboard(
                  selectedCall.messages[selectedCall.messages.length - 1]?.content || '',
                  'user'
                )}
                copyLabel={copied === 'user' ? 'Copied!' : 'Copy'}
              >
                <pre className="text-sm whitespace-pre-wrap">
                  {selectedCall.messages[selectedCall.messages.length - 1]?.content || '(no message)'}
                </pre>
              </CollapsibleSection>

              {/* Response - expanded by default */}
              <CollapsibleSection
                title="Response"
                defaultOpen={true}
                onCopy={() => copyToClipboard(selectedCall.response || '', 'response')}
                copyLabel={copied === 'response' ? 'Copied!' : 'Copy'}
              >
                {selectedCall.error ? (
                  <div className="text-red-500 text-sm">{selectedCall.error}</div>
                ) : (
                  <pre className="text-sm whitespace-pre-wrap">
                    {selectedCall.response || '(no response)'}
                  </pre>
                )}
              </CollapsibleSection>

              {/* Metadata - collapsed by default */}
              <CollapsibleSection title={`Metadata (${selectedCall.latencyMs}ms)`}>
                <div className="text-sm space-y-1">
                  <div><span className="text-gray-500">Model:</span> {selectedCall.model}</div>
                  <div><span className="text-gray-500">Type:</span> {selectedCall.callType}</div>
                  <div><span className="text-gray-500">Time:</span> {new Date(selectedCall.timestamp).toLocaleString()}</div>
                  <div><span className="text-gray-500">Latency:</span> {selectedCall.latencyMs}ms</div>
                  <div className="text-xs text-gray-400 mt-2">ID: {selectedCall.id}</div>
                </div>
              </CollapsibleSection>

              {/* System Prompt - collapsed by default */}
              <CollapsibleSection
                title="System Prompt"
                onCopy={() => copyToClipboard(selectedCall.systemPrompt, 'system')}
                copyLabel={copied === 'system' ? 'Copied!' : 'Copy'}
              >
                <pre className="text-sm whitespace-pre-wrap">
                  {selectedCall.systemPrompt}
                </pre>
              </CollapsibleSection>

              {/* Message History - collapsed, only show if there are previous messages */}
              {selectedCall.messages.length > 1 && (
                <CollapsibleSection
                  title={`Message History (${selectedCall.messages.length - 1} previous)`}
                  onCopy={() => copyToClipboard(JSON.stringify(selectedCall.messages.slice(0, -1), null, 2), 'history')}
                  copyLabel={copied === 'history' ? 'Copied!' : 'Copy'}
                >
                  <div className="space-y-2">
                    {selectedCall.messages.slice(0, -1).map((msg, i) => (
                      <div key={i} className="border-l-2 border-gray-300 dark:border-gray-600 pl-3">
                        <div className="text-xs text-gray-500 mb-1">{msg.role}</div>
                        <pre className="text-sm whitespace-pre-wrap">{msg.content}</pre>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Options - collapsed by default */}
              <CollapsibleSection title="Options">
                <pre className="text-sm whitespace-pre-wrap">
                  {JSON.stringify(selectedCall.options, null, 2)}
                </pre>
              </CollapsibleSection>
            </div>
          ) : (
            <p className="text-gray-500">Select a call to view details</p>
          )}
        </div>
      </div>
    </div>
  );
}
