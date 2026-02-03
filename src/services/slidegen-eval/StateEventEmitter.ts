import {
  PromptEnhancerConfig,
  EvalTestCase,
  EvalTestResult,
  ChangelogEntry,
} from '@/types/slidegen-eval';

// =============================================================================
// SSE Event Types
// =============================================================================

export interface ConfigUpdatedEvent {
  type: 'config_updated';
  config: PromptEnhancerConfig;
}

export interface TestCaseAddedEvent {
  type: 'test_case_added';
  testCase: EvalTestCase;
}

export interface TestCaseUpdatedEvent {
  type: 'test_case_updated';
  testCase: EvalTestCase;
}

export interface TestCaseDeletedEvent {
  type: 'test_case_deleted';
  testCaseId: string;
}

export interface TestResultUpdatedEvent {
  type: 'test_result_updated';
  result: EvalTestResult;
}

export interface ChangelogEntryAddedEvent {
  type: 'changelog_entry_added';
  entry: ChangelogEntry;
}

export interface ConnectedEvent {
  type: 'connected';
  clientId: string;
}

export type StateEvent =
  | ConfigUpdatedEvent
  | TestCaseAddedEvent
  | TestCaseUpdatedEvent
  | TestCaseDeletedEvent
  | TestResultUpdatedEvent
  | ChangelogEntryAddedEvent
  | ConnectedEvent;

// =============================================================================
// Subscriber Type
// =============================================================================

export type StateEventSubscriber = (event: StateEvent) => void;

// =============================================================================
// StateEventEmitter
// =============================================================================

/**
 * Server-side event emitter for broadcasting state changes to all connected SSE clients.
 *
 * This is a singleton that lives in the server process. When any mutation happens
 * (from UI or agent), the relevant API route calls `emit()` to broadcast the change
 * to all subscribed clients.
 *
 * Usage:
 * - SSE endpoint subscribes clients with `subscribe(callback)`
 * - API routes emit events with `emit(event)`
 * - When SSE connection closes, call `unsubscribe(callback)`
 */
class StateEventEmitterImpl {
  private subscribers: Set<StateEventSubscriber> = new Set();
  private nextClientId = 1;

  /**
   * Subscribe to state events.
   * Returns a client ID for tracking and a cleanup function.
   */
  subscribe(callback: StateEventSubscriber): { clientId: string; unsubscribe: () => void } {
    const clientId = `client-${this.nextClientId++}`;
    this.subscribers.add(callback);

    // Send connected event to the new subscriber
    try {
      callback({ type: 'connected', clientId });
    } catch (error) {
      console.error('[StateEventEmitter] Error sending connected event:', error);
      // Remove failing subscriber immediately
      this.subscribers.delete(callback);
    }

    return {
      clientId,
      unsubscribe: () => {
        this.subscribers.delete(callback);
      },
    };
  }

  /**
   * Unsubscribe from state events.
   */
  unsubscribe(callback: StateEventSubscriber): void {
    this.subscribers.delete(callback);
  }

  /**
   * Emit an event to all subscribers.
   */
  emit(event: StateEvent): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (error) {
        console.error('[StateEventEmitter] Error in subscriber:', error);
        // Remove failed subscriber to prevent repeated errors
        this.subscribers.delete(subscriber);
      }
    }
  }

  /**
   * Get the current number of subscribers (for debugging).
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Clear all subscribers (for testing).
   */
  clearAllSubscribers(): void {
    this.subscribers.clear();
  }
}

// Export singleton instance
export const stateEventEmitter = new StateEventEmitterImpl();

// Also export the class for testing with isolated instances
export { StateEventEmitterImpl };
