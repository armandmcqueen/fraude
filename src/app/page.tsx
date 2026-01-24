'use client';

import { useState, useCallback, useMemo } from 'react';
import { Sidebar } from '@/components/sidebar';
import { ChatView } from '@/components/chat';
import { useConversations } from '@/hooks';
import {
  ChatSession,
  TitleService,
  APILLMClient,
  APIStorageClient,
  DefaultPromptProvider,
} from '@/services';

export default function Home() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const { conversations, loading, refresh } = useConversations();

  // Create services once (memoized)
  const session = useMemo(() => {
    const llmClient = new APILLMClient();
    const storageClient = new APIStorageClient();
    const promptProvider = new DefaultPromptProvider();
    const titleService = new TitleService(llmClient);

    return new ChatSession({
      llmClient,
      storageClient,
      promptProvider,
      titleService,
    });
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
  }, []);

  const handleSelectConversation = useCallback((id: string | null) => {
    setActiveConversationId(id);
  }, []);

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onCreate={handleNewChat}
        loading={loading}
      />
      <ChatView
        session={session}
        conversationId={activeConversationId}
        onConversationUpdate={refresh}
      />
    </div>
  );
}
