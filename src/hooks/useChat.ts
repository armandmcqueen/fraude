'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Conversation } from '@/types';
import { ChatSessionInterface } from '@/services';

interface UseChatOptions {
  onConversationUpdate?: () => void;
}

/**
 * React hook that wraps a chat session (single or multi-actor).
 * Subscribes to session events and exposes state + methods to components.
 */
export function useChat(session: ChatSessionInterface, options?: UseChatOptions) {
  const [conversation, setConversation] = useState<Conversation | null>(
    session.getConversation()
  );
  const [isStreaming, setIsStreaming] = useState(session.getIsStreaming());
  const [error, setError] = useState<string | null>(null);

  // Track if we've notified about conversation update (to avoid duplicate calls)
  const lastSavedId = useRef<string | null>(null);

  useEffect(() => {
    // Subscribe to session events
    const unsubConversation = session.events.on('conversationUpdated', (conv) => {
      setConversation(conv);
    });

    const unsubStreamStart = session.events.on('streamStart', () => {
      setIsStreaming(true);
      setError(null);
    });

    const unsubStreamEnd = session.events.on('streamEnd', () => {
      setIsStreaming(false);

      // Notify parent that conversation was updated (for sidebar refresh)
      const conv = session.getConversation();
      if (conv && conv.id !== lastSavedId.current) {
        lastSavedId.current = conv.id;
        options?.onConversationUpdate?.();
      }
    });

    const unsubError = session.events.on('error', (err) => {
      setError(err.message);
    });

    return () => {
      unsubConversation();
      unsubStreamStart();
      unsubStreamEnd();
      unsubError();
    };
  }, [session, options]);

  const loadConversation = useCallback(
    async (id: string) => {
      try {
        setError(null);
        await session.loadConversation(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
      }
    },
    [session]
  );

  const createNewConversation = useCallback(
    (model?: string) => {
      setError(null);
      session.createNewConversation(model);
    },
    [session]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      await session.sendMessage(content);
    },
    [session]
  );

  const setModel = useCallback(
    (model: string) => {
      session.setModel(model);
    },
    [session]
  );

  return {
    conversation,
    isStreaming,
    error,
    loadConversation,
    createNewConversation,
    sendMessage,
    setModel,
  };
}
