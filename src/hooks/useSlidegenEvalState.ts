'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PromptEnhancerConfig,
  EvalTestCase,
  EvalTestResult,
} from '@/types/slidegen-eval';

interface SlidegenEvalState {
  config: PromptEnhancerConfig | null;
  testCases: EvalTestCase[];
  results: Map<string, EvalTestResult>; // Keyed by testCaseId for quick lookup
  isConnected: boolean;
  error: string | null;
}

interface UseSlidegenEvalStateReturn extends SlidegenEvalState {
  // Actions
  updateConfig: (systemPrompt: string) => Promise<void>;
  createTestCase: (name: string, inputText: string) => Promise<EvalTestCase>;
  updateTestCase: (id: string, updates: { name?: string; inputText?: string }) => Promise<void>;
  deleteTestCase: (id: string) => Promise<void>;
  runTest: (testCaseId: string) => Promise<void>;
  runAllTests: () => Promise<void>;
  // Loading states
  isSavingConfig: boolean;
  isRunningTest: string | null; // testCaseId of currently running test
  isRunningAllTests: boolean;
}

/**
 * Hook for managing Slidegen Eval state with real-time SSE updates.
 *
 * Subscribes to the state-stream SSE endpoint and receives:
 * - Initial state on connection
 * - Real-time updates for all mutations (from UI or agent)
 *
 * All mutations go through the server API, which broadcasts changes via SSE.
 */
export function useSlidegenEvalState(): UseSlidegenEvalStateReturn {
  const [config, setConfig] = useState<PromptEnhancerConfig | null>(null);
  const [testCases, setTestCases] = useState<EvalTestCase[]>([]);
  const [results, setResults] = useState<Map<string, EvalTestResult>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loading states
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isRunningTest, setIsRunningTest] = useState<string | null>(null);
  const [isRunningAllTests, setIsRunningAllTests] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(1000); // Start with 1 second, exponential backoff
  const MAX_RECONNECT_DELAY = 30000; // Max 30 seconds

  // Parse dates from JSON
  const parseConfig = (data: PromptEnhancerConfig): PromptEnhancerConfig => ({
    ...data,
    updatedAt: new Date(data.updatedAt),
  });

  const parseTestCase = (data: EvalTestCase): EvalTestCase => ({
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  });

  const parseResult = (data: EvalTestResult): EvalTestResult => ({
    ...data,
    runStartedAt: new Date(data.runStartedAt),
    runCompletedAt: data.runCompletedAt ? new Date(data.runCompletedAt) : undefined,
  });

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('/api/slidegen-eval/state-stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      // Reset reconnect delay on successful connection
      reconnectDelayRef.current = 1000;
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();

      // Reconnect with exponential backoff
      const delay = reconnectDelayRef.current;
      setError(`Disconnected. Reconnecting in ${Math.round(delay / 1000)}s...`);

      reconnectTimeoutRef.current = setTimeout(() => {
        setError(null);
        connect();
      }, delay);

      // Increase delay for next attempt (exponential backoff with max)
      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'connected':
            // Just a connection confirmation
            break;

          case 'initial_state':
            // Set initial state
            if (data.data.config) {
              setConfig(parseConfig(data.data.config));
            }
            setTestCases(data.data.testCases.map(parseTestCase));
            const resultsMap = new Map<string, EvalTestResult>();
            for (const result of data.data.results) {
              const parsed = parseResult(result);
              resultsMap.set(parsed.testCaseId, parsed);
            }
            setResults(resultsMap);
            break;

          case 'config_updated':
            setConfig(parseConfig(data.config));
            break;

          case 'test_case_added':
            setTestCases((prev) => [...prev, parseTestCase(data.testCase)]);
            break;

          case 'test_case_updated':
            setTestCases((prev) =>
              prev.map((tc) =>
                tc.id === data.testCase.id ? parseTestCase(data.testCase) : tc
              )
            );
            break;

          case 'test_case_deleted':
            setTestCases((prev) => prev.filter((tc) => tc.id !== data.testCaseId));
            setResults((prev) => {
              const next = new Map(prev);
              next.delete(data.testCaseId);
              return next;
            });
            break;

          case 'test_result_updated':
            const result = parseResult(data.result);
            setResults((prev) => {
              const next = new Map(prev);
              next.set(result.testCaseId, result);
              return next;
            });
            // Clear running state when test completes
            if (result.status === 'complete' || result.status === 'error') {
              setIsRunningTest((current) =>
                current === result.testCaseId ? null : current
              );
            }
            break;

          case 'changelog_entry_added':
            // We could track changelog entries if needed
            break;
        }
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    return eventSource;
  }, []);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // Actions
  const updateConfig = useCallback(async (systemPrompt: string) => {
    setIsSavingConfig(true);
    try {
      const response = await fetch('/api/slidegen-eval/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt }),
      });
      if (!response.ok) {
        throw new Error('Failed to update config');
      }
      // State will be updated via SSE
    } finally {
      setIsSavingConfig(false);
    }
  }, []);

  const createTestCase = useCallback(async (name: string, inputText: string): Promise<EvalTestCase> => {
    const response = await fetch('/api/slidegen-eval/test-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, inputText }),
    });
    if (!response.ok) {
      throw new Error('Failed to create test case');
    }
    const data = await response.json();
    // State will be updated via SSE
    return parseTestCase(data.testCase);
  }, []);

  const updateTestCase = useCallback(async (id: string, updates: { name?: string; inputText?: string }) => {
    const response = await fetch(`/api/slidegen-eval/test-cases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error('Failed to update test case');
    }
    // State will be updated via SSE
  }, []);

  const deleteTestCase = useCallback(async (id: string) => {
    const response = await fetch(`/api/slidegen-eval/test-cases/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete test case');
    }
    // State will be updated via SSE
  }, []);

  const runTest = useCallback(async (testCaseId: string) => {
    setIsRunningTest(testCaseId);
    try {
      const response = await fetch('/api/slidegen-eval/run-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCaseId }),
      });
      if (!response.ok) {
        throw new Error('Failed to run test');
      }
      // Progress will be updated via SSE
    } catch (e) {
      setIsRunningTest(null);
      throw e;
    }
  }, []);

  const runAllTests = useCallback(async () => {
    setIsRunningAllTests(true);
    try {
      const response = await fetch('/api/slidegen-eval/run-all-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Failed to run all tests');
      }
      // Progress will be updated via SSE
    } finally {
      setIsRunningAllTests(false);
    }
  }, []);

  return {
    config,
    testCases,
    results,
    isConnected,
    error,
    updateConfig,
    createTestCase,
    updateTestCase,
    deleteTestCase,
    runTest,
    runAllTests,
    isSavingConfig,
    isRunningTest,
    isRunningAllTests,
  };
}
