import { useState, useCallback, useRef } from 'react';
import {
  AgentTurn,
  UserTurn,
  AssistantTextTurn,
  ToolCallTurn,
  ToolResultTurn,
} from '@/types';

interface UseAgentChatOptions {
  personaId: string;
}

interface UseAgentChatReturn {
  turns: AgentTurn[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearConversation: () => Promise<void>;
  loadHistory: () => Promise<void>;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function useAgentChat({ personaId }: UseAgentChatOptions): UseAgentChatReturn {
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/persona-agent/history?personaId=${personaId}`);
      if (response.ok) {
        const data = await response.json();
        // Convert date strings back to Date objects
        const loadedTurns = data.turns.map((turn: AgentTurn) => ({
          ...turn,
          createdAt: new Date(turn.createdAt),
        }));
        setTurns(loadedTurns);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }, [personaId]);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    // Add user turn immediately
    const userTurn: UserTurn = {
      type: 'user',
      id: generateId(),
      content: message,
      createdAt: new Date(),
    };
    setTurns((prev) => [...prev, userTurn]);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/persona-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, message }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentTextContent = '';
      let currentTextId = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (!data) continue;

            try {
              const event = JSON.parse(data);

              switch (event.type) {
                case 'text_delta':
                  if (!currentTextId) {
                    currentTextId = generateId();
                    currentTextContent = '';
                  }
                  currentTextContent += event.content;
                  // Update or add the text turn
                  setTurns((prev) => {
                    const existingIndex = prev.findIndex(
                      (t) => t.type === 'assistant_text' && t.id === currentTextId
                    );
                    const textTurn: AssistantTextTurn = {
                      type: 'assistant_text',
                      id: currentTextId,
                      content: currentTextContent,
                      createdAt: new Date(),
                    };
                    if (existingIndex >= 0) {
                      const updated = [...prev];
                      updated[existingIndex] = textTurn;
                      return updated;
                    }
                    return [...prev, textTurn];
                  });
                  break;

                case 'text_complete':
                  // Finalize text turn
                  currentTextId = '';
                  currentTextContent = '';
                  break;

                case 'tool_call':
                  const toolCallTurn: ToolCallTurn = {
                    type: 'tool_call',
                    id: event.id,
                    toolUseId: event.toolUseId,
                    toolName: event.toolName,
                    input: event.input,
                    createdAt: new Date(),
                  };
                  setTurns((prev) => [...prev, toolCallTurn]);
                  break;

                case 'tool_result':
                  const toolResultTurn: ToolResultTurn = {
                    type: 'tool_result',
                    id: event.id,
                    toolUseId: event.toolUseId,
                    output: event.output,
                    isError: event.isError,
                    createdAt: new Date(),
                  };
                  setTurns((prev) => [...prev, toolResultTurn]);
                  break;

                case 'error':
                  setError(event.message);
                  break;

                case 'done':
                  // Stream complete
                  break;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [personaId, isLoading]);

  const clearConversation = useCallback(async () => {
    try {
      const response = await fetch('/api/persona-agent/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId }),
      });

      if (response.ok) {
        setTurns([]);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to clear conversation:', err);
    }
  }, [personaId]);

  return {
    turns,
    isLoading,
    error,
    sendMessage,
    clearConversation,
    loadHistory,
  };
}
