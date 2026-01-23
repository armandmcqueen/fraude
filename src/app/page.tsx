'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar';
import { ChatView } from '@/components/chat';
import { useConversations } from '@/hooks';

export default function Home() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const { conversations, loading, refresh } = useConversations();

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
        conversationId={activeConversationId}
        onConversationUpdate={refresh}
      />
    </div>
  );
}
