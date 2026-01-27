'use client';

import { useEffect, useRef } from 'react';
import { Message as MessageType } from '@/types';
import { Message } from './Message';

interface MessageListProps {
  messages: MessageType[];
  isStreaming: boolean;
  getPersonaName?: (id: string) => string;
}

export function MessageList({ messages, isStreaming, getPersonaName }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoScrollEnabled = useRef(true);
  const lastScrollTop = useRef(0);

  // Handle scroll events to detect direction and position
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const isScrollingUp = currentScrollTop < lastScrollTop.current;
    lastScrollTop.current = currentScrollTop;

    // If user scrolls up, disable auto-scroll
    if (isScrollingUp) {
      autoScrollEnabled.current = false;
    }

    // If user scrolls to bottom (within threshold), re-enable auto-scroll
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 50) {
      autoScrollEnabled.current = true;
    }
  };

  // Auto-scroll when messages change, if enabled
  useEffect(() => {
    if (autoScrollEnabled.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Always enable auto-scroll and scroll when streaming starts
  useEffect(() => {
    if (isStreaming) {
      autoScrollEnabled.current = true;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>Start a conversation by sending a message below.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4"
    >
      {messages.map((message) => {
        const isActivelyStreaming =
          isStreaming &&
          message.role === 'assistant' &&
          message.content === '';

        return (
          <Message
            key={message.id}
            message={message}
            isStreaming={isActivelyStreaming}
            getPersonaName={getPersonaName}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
