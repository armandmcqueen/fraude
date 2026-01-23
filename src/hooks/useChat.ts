'use client';

import { useState, useCallback } from 'react';
import { Message, Conversation, StreamChunk } from '@/types';
import { generateId } from '@/lib/utils';
import { config } from '@/lib/config';

interface UseChatOptions {
  onConversationUpdate?: () => void;
}

export function useChat(options?: UseChatOptions) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/storage/conversations/${id}`);
      if (!response.ok) throw new Error('Failed to load conversation');
      const data = await response.json();
      setConversation({
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        messages: data.messages.map((m: Message) => ({
          ...m,
          createdAt: new Date(m.createdAt),
        })),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    }
  }, []);

  const createNewConversation = useCallback((model?: string) => {
    const now = new Date();
    setConversation({
      id: generateId(),
      title: 'New conversation',
      messages: [],
      model: model || config.defaultModel,
      createdAt: now,
      updatedAt: now,
    });
    setError(null);
  }, []);

  const saveConversation = useCallback(
    async (conv: Conversation, isNew: boolean) => {
      const endpoint = '/api/storage/conversations' + (isNew ? '' : `/${conv.id}`);
      const method = isNew ? 'POST' : 'PUT';

      await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conv),
      });

      options?.onConversationUpdate?.();
    },
    [options]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversation || isStreaming) return;

      const isNewConversation = conversation.messages.length === 0;

      // Create user message
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content,
        createdAt: new Date(),
      };

      // Create placeholder assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: '',
        createdAt: new Date(),
      };

      // Update local state optimistically
      const updatedConversation: Conversation = {
        ...conversation,
        messages: [...conversation.messages, userMessage, assistantMessage],
        updatedAt: new Date(),
      };
      setConversation(updatedConversation);
      setIsStreaming(true);
      setError(null);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...conversation.messages, userMessage],
            options: { model: conversation.model },
          }),
        });

        if (!response.ok) throw new Error('Failed to send message');

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let assistantContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            const chunk: StreamChunk = JSON.parse(line);

            if (chunk.type === 'text' && chunk.content) {
              assistantContent += chunk.content;

              // Update the assistant message content
              setConversation((prev) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMessage = messages[messages.length - 1];
                if (lastMessage.role === 'assistant') {
                  lastMessage.content = assistantContent;
                }
                return { ...prev, messages };
              });
            } else if (chunk.type === 'error') {
              throw new Error(chunk.error || 'Stream error');
            }
          }
        }

        // Generate title using LLM if this is the first message
        let finalTitle = conversation.title;
        if (isNewConversation) {
          try {
            const titleResponse = await fetch('/api/generate-title', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userMessage: content }),
            });
            if (titleResponse.ok) {
              const { title } = await titleResponse.json();
              finalTitle = title;
            }
          } catch {
            // Fallback to simple title generation
            const firstLine = content.split(/[.\n]/)[0].trim();
            finalTitle = firstLine.length <= 50 ? firstLine : firstLine.substring(0, 47) + '...';
          }
        }

        // Save the conversation
        const finalConversation: Conversation = {
          ...conversation,
          title: finalTitle,
          messages: [
            ...conversation.messages,
            userMessage,
            { ...assistantMessage, content: assistantContent },
          ],
          updatedAt: new Date(),
        };

        setConversation(finalConversation);
        await saveConversation(finalConversation, isNewConversation);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);

        // Add error as a message
        setConversation((prev) => {
          if (!prev) return prev;
          const messages = [...prev.messages];
          const lastMessage = messages[messages.length - 1];
          if (lastMessage.role === 'assistant' && !lastMessage.content) {
            lastMessage.content = `Error: ${errorMessage}`;
          }
          return { ...prev, messages };
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [conversation, isStreaming, saveConversation]
  );

  const setModel = useCallback((model: string) => {
    setConversation((prev) => (prev ? { ...prev, model } : prev));
  }, []);

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
