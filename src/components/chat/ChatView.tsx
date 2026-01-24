'use client';

import { useEffect, useState } from 'react';
import { useChat } from '@/hooks';
import { ChatSession } from '@/services';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { LLMInspector } from '@/components/inspector';

interface ChatViewProps {
  session: ChatSession;
  conversationId: string | null;
  onConversationUpdate?: () => void;
}

export function ChatView({ session, conversationId, onConversationUpdate }: ChatViewProps) {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const {
    conversation,
    isStreaming,
    error,
    loadConversation,
    createNewConversation,
    setModel,
    sendMessage,
  } = useChat(session, { onConversationUpdate });

  // Load conversation when ID changes
  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    } else {
      createNewConversation();
    }
  }, [conversationId, loadConversation, createNewConversation]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold text-lg truncate">{conversation.title}</h2>
        <button
          onClick={() => setInspectorOpen(!inspectorOpen)}
          className={`p-2 rounded-md transition-colors ${
            inspectorOpen
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
          }`}
          title="LLM Call Inspector"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900 border-b border-red-200 dark:border-red-800 px-4 py-2 text-red-700 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Messages */}
      <MessageList messages={conversation.messages} isStreaming={isStreaming} />

      {/* Input */}
      <InputArea
        onSend={sendMessage}
        disabled={isStreaming}
        model={conversation.model}
        onModelChange={setModel}
      />

      {/* LLM Inspector */}
      <LLMInspector
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        conversationId={conversation.id}
      />
    </div>
  );
}
