'use client';

import { useState, useEffect, useRef } from 'react';
import { Message as MessageType } from '@/types';
import { Message } from './Message';

interface MessageExchange {
  userMessage: MessageType;
  personaResponses: MessageType[];
}

interface FocusedMessageGroupProps {
  exchange: MessageExchange;
  isStreaming: boolean;
  getPersonaName?: (id: string) => string;
  /** Order of persona IDs for consistent tab ordering */
  personaOrder?: string[];
  /** Set of message IDs currently being summarized */
  summarizingMessageIds?: Set<string>;
}

function PersonaTabs({
  responses,
  activePersonaId,
  onSelect,
  isStreaming,
  getPersonaName,
  position,
}: {
  responses: MessageType[];
  activePersonaId: string | null;
  onSelect: (id: string) => void;
  isStreaming: boolean;
  getPersonaName: (id: string) => string;
  position: 'top' | 'bottom';
}) {
  const isTop = position === 'top';

  return (
    <div className="flex gap-1 flex-wrap">
      {responses.map((response) => {
        const personaId = response.personaId || 'unknown';
        const isActive = personaId === activePersonaId;
        const isEmpty = !response.content;
        const isThisStreaming = isStreaming && isEmpty;

        return (
          <button
            key={response.id}
            onClick={() => onSelect(personaId)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              isTop ? 'rounded-t-lg' : 'rounded-b-lg'
            } ${
              isActive
                ? `bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border ${
                    isTop ? 'border-b-0' : 'border-t-0'
                  } border-gray-200 dark:border-gray-700`
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {getPersonaName(personaId)}
              {isThisStreaming && (
                <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FocusedMessageGroup({
  exchange,
  isStreaming,
  getPersonaName,
  personaOrder = [],
  summarizingMessageIds = new Set(),
}: FocusedMessageGroupProps) {
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Sort responses by persona order, putting unknown personas at the end
  const sortedResponses = [...exchange.personaResponses].sort((a, b) => {
    const aIndex = personaOrder.indexOf(a.personaId || '');
    const bIndex = personaOrder.indexOf(b.personaId || '');
    // -1 means not found, put at end
    const aOrder = aIndex === -1 ? Infinity : aIndex;
    const bOrder = bIndex === -1 ? Infinity : bIndex;
    return aOrder - bOrder;
  });

  // Set initial active persona if not set
  useEffect(() => {
    if (!activePersonaId && sortedResponses.length > 0) {
      setActivePersonaId(sortedResponses[0].personaId || null);
    }
  }, [activePersonaId, sortedResponses]);

  // Switch to a new persona tab when a new response starts streaming
  useEffect(() => {
    if (isStreaming && sortedResponses.length > 0) {
      // Find any response that's currently empty (being streamed)
      const streamingResponse = sortedResponses.find((r) => r.content === '');
      if (streamingResponse?.personaId) {
        setActivePersonaId(streamingResponse.personaId);
      }
    }
  }, [isStreaming, sortedResponses]);

  // Handle manual tab selection with scroll to top
  const handleTabSelect = (personaId: string) => {
    setActivePersonaId(personaId);
    // Scroll the content into view when switching tabs
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activeResponse = sortedResponses.find(
    (r) => r.personaId === activePersonaId
  );

  const resolvePersonaName = getPersonaName || ((id: string) => id);

  return (
    <div className="mb-6">
      {/* User message */}
      <Message
        message={exchange.userMessage}
        getPersonaName={getPersonaName}
      />

      {/* Persona response section */}
      {sortedResponses.length > 0 && (
        <div className="mt-2" ref={contentRef}>
          {/* Sticky top tab bar - negative top to cover container padding area */}
          <div className="sticky -top-4 z-10 bg-white dark:bg-gray-950 -mx-4 px-4 -mt-4 pt-4 pb-2">
            <PersonaTabs
              responses={sortedResponses}
              activePersonaId={activePersonaId}
              onSelect={handleTabSelect}
              isStreaming={isStreaming}
              getPersonaName={resolvePersonaName}
              position="top"
            />
          </div>

          {/* Active response content */}
          {activeResponse && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <div className="p-1">
                <Message
                  message={activeResponse}
                  isStreaming={isStreaming && !activeResponse.content}
                  getPersonaName={getPersonaName}
                  isSummarizing={summarizingMessageIds.has(activeResponse.id)}
                />
              </div>
            </div>
          )}

          {/* Bottom tab bar for easy switching after reading */}
          <div className="mt-2">
            <PersonaTabs
              responses={sortedResponses}
              activePersonaId={activePersonaId}
              onSelect={handleTabSelect}
              isStreaming={isStreaming}
              getPersonaName={resolvePersonaName}
              position="bottom"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Group messages into exchanges (user message + persona responses).
 */
export function groupMessagesIntoExchanges(messages: MessageType[]): MessageExchange[] {
  const exchanges: MessageExchange[] = [];
  let currentExchange: MessageExchange | null = null;

  for (const message of messages) {
    if (message.role === 'user') {
      // Start a new exchange
      if (currentExchange) {
        exchanges.push(currentExchange);
      }
      currentExchange = {
        userMessage: message,
        personaResponses: [],
      };
    } else if (message.role === 'assistant' && currentExchange) {
      // Add to current exchange
      currentExchange.personaResponses.push(message);
    }
  }

  // Push the last exchange
  if (currentExchange) {
    exchanges.push(currentExchange);
  }

  return exchanges;
}
