'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConversationSummary } from '@/types';

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/storage/conversations');
      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      // Convert date strings to Date objects
      setConversations(
        data.map((c: ConversationSummary) => ({
          ...c,
          updatedAt: new Date(c.updatedAt),
        }))
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    loading,
    error,
    refresh: fetchConversations,
  };
}
