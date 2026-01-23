'use client';

import { useEffect } from 'react';
import { useChat } from '@/hooks';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';

interface ChatViewProps {
  conversationId: string | null;
  onConversationUpdate?: () => void;
}

export function ChatView({ conversationId, onConversationUpdate }: ChatViewProps) {
  const {
    conversation,
    isStreaming,
    error,
    loadConversation,
    createNewConversation,
    sendMessage,
    setModel,
  } = useChat({ onConversationUpdate });

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
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <h2 className="font-semibold text-lg truncate">{conversation.title}</h2>
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
    </div>
  );
}
