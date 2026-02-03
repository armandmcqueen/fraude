import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateEventEmitterImpl, StateEvent } from '@/services/slidegen-eval';

describe('StateEventEmitter', () => {
  let emitter: StateEventEmitterImpl;

  beforeEach(() => {
    // Create a fresh emitter for each test (not the singleton)
    emitter = new StateEventEmitterImpl();
  });

  describe('subscribe', () => {
    it('should return a client ID and unsubscribe function', () => {
      const callback = vi.fn();
      const { clientId, unsubscribe } = emitter.subscribe(callback);

      expect(clientId).toMatch(/^client-\d+$/);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should send connected event immediately upon subscription', () => {
      const callback = vi.fn();
      const { clientId } = emitter.subscribe(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        type: 'connected',
        clientId,
      });
    });

    it('should increment client IDs', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const { clientId: id1 } = emitter.subscribe(callback1);
      const { clientId: id2 } = emitter.subscribe(callback2);

      expect(id1).not.toBe(id2);
      // Extract numbers and verify they're sequential
      const num1 = parseInt(id1.replace('client-', ''));
      const num2 = parseInt(id2.replace('client-', ''));
      expect(num2).toBe(num1 + 1);
    });
  });

  describe('unsubscribe', () => {
    it('should remove subscriber via returned unsubscribe function', () => {
      const callback = vi.fn();
      const { unsubscribe } = emitter.subscribe(callback);

      // Clear the connected event call
      callback.mockClear();

      unsubscribe();

      emitter.emit({ type: 'config_updated', config: {} as never });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should remove subscriber via unsubscribe method', () => {
      const callback = vi.fn();
      emitter.subscribe(callback);

      // Clear the connected event call
      callback.mockClear();

      emitter.unsubscribe(callback);

      emitter.emit({ type: 'config_updated', config: {} as never });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle unsubscribing non-existent subscriber gracefully', () => {
      const callback = vi.fn();

      // Should not throw
      emitter.unsubscribe(callback);
    });
  });

  describe('emit', () => {
    it('should emit event to all subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      emitter.subscribe(callback1);
      emitter.subscribe(callback2);
      emitter.subscribe(callback3);

      // Clear connected event calls
      callback1.mockClear();
      callback2.mockClear();
      callback3.mockClear();

      const event: StateEvent = {
        type: 'config_updated',
        config: {
          id: 'default',
          systemPrompt: 'test',
          version: 1,
          updatedAt: new Date(),
        },
      };

      emitter.emit(event);

      expect(callback1).toHaveBeenCalledWith(event);
      expect(callback2).toHaveBeenCalledWith(event);
      expect(callback3).toHaveBeenCalledWith(event);
    });

    it('should not emit to unsubscribed callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      emitter.subscribe(callback1);
      const { unsubscribe } = emitter.subscribe(callback2);

      // Clear connected events
      callback1.mockClear();
      callback2.mockClear();

      unsubscribe();

      emitter.emit({ type: 'test_case_deleted', testCaseId: 'tc-1' });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should handle subscriber errors gracefully during emit', () => {
      const goodCallback = vi.fn();
      // Create a callback that works on first call (connected) but fails on subsequent calls
      let callCount = 0;
      const badCallback = vi.fn(() => {
        callCount++;
        if (callCount > 1) {
          throw new Error('Subscriber error');
        }
      });
      const anotherGoodCallback = vi.fn();

      emitter.subscribe(goodCallback);
      emitter.subscribe(badCallback);
      emitter.subscribe(anotherGoodCallback);

      // Clear connected events
      goodCallback.mockClear();
      badCallback.mockClear();
      anotherGoodCallback.mockClear();

      // Should not throw - bad callback fails but others continue
      emitter.emit({ type: 'test_case_deleted', testCaseId: 'tc-1' });

      // Good callbacks should still be called
      expect(goodCallback).toHaveBeenCalled();
      expect(anotherGoodCallback).toHaveBeenCalled();
    });

    it('should remove failing subscribers after emit error', () => {
      // Create a callback that works on first call (connected) but fails on subsequent calls
      let callCount = 0;
      const badCallback = vi.fn(() => {
        callCount++;
        if (callCount > 1) {
          throw new Error('Subscriber error');
        }
      });

      emitter.subscribe(badCallback);
      badCallback.mockClear();

      // First emit removes the failing subscriber
      emitter.emit({ type: 'test_case_deleted', testCaseId: 'tc-1' });
      badCallback.mockClear();

      // Second emit should not call it
      emitter.emit({ type: 'test_case_deleted', testCaseId: 'tc-2' });

      expect(badCallback).not.toHaveBeenCalled();
    });

    it('should remove subscriber that fails during connected event', () => {
      const badCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });

      emitter.subscribe(badCallback);

      // Subscriber should have been removed because it failed on connected event
      expect(emitter.getSubscriberCount()).toBe(0);
    });

    it('should emit different event types correctly', () => {
      const callback = vi.fn();
      emitter.subscribe(callback);
      callback.mockClear();

      const events: StateEvent[] = [
        {
          type: 'config_updated',
          config: { id: 'default', systemPrompt: 'test', version: 1, updatedAt: new Date() },
        },
        {
          type: 'test_case_added',
          testCase: { id: 'tc-1', name: 'Test', inputText: 'input', createdAt: new Date(), updatedAt: new Date() },
        },
        {
          type: 'test_case_updated',
          testCase: { id: 'tc-1', name: 'Updated', inputText: 'input', createdAt: new Date(), updatedAt: new Date() },
        },
        {
          type: 'test_case_deleted',
          testCaseId: 'tc-1',
        },
        {
          type: 'test_result_updated',
          result: {
            id: 'r-1',
            testCaseId: 'tc-1',
            configVersion: 1,
            enhancedPrompt: 'prompt',
            status: 'complete',
            runStartedAt: new Date(),
          },
        },
        {
          type: 'changelog_entry_added',
          entry: {
            id: 'cl-1',
            timestamp: new Date(),
            source: 'ui',
            action: 'config_updated',
            summary: 'Config updated',
          },
        },
      ];

      for (const event of events) {
        callback.mockClear();
        emitter.emit(event);
        expect(callback).toHaveBeenCalledWith(event);
      }
    });
  });

  describe('getSubscriberCount', () => {
    it('should return 0 when no subscribers', () => {
      expect(emitter.getSubscriberCount()).toBe(0);
    });

    it('should return correct count after subscribing', () => {
      emitter.subscribe(vi.fn());
      emitter.subscribe(vi.fn());
      emitter.subscribe(vi.fn());

      expect(emitter.getSubscriberCount()).toBe(3);
    });

    it('should return correct count after unsubscribing', () => {
      const { unsubscribe: unsub1 } = emitter.subscribe(vi.fn());
      emitter.subscribe(vi.fn());
      const { unsubscribe: unsub3 } = emitter.subscribe(vi.fn());

      expect(emitter.getSubscriberCount()).toBe(3);

      unsub1();
      expect(emitter.getSubscriberCount()).toBe(2);

      unsub3();
      expect(emitter.getSubscriberCount()).toBe(1);
    });
  });

  describe('clearAllSubscribers', () => {
    it('should remove all subscribers', () => {
      emitter.subscribe(vi.fn());
      emitter.subscribe(vi.fn());
      emitter.subscribe(vi.fn());

      expect(emitter.getSubscriberCount()).toBe(3);

      emitter.clearAllSubscribers();

      expect(emitter.getSubscriberCount()).toBe(0);
    });
  });
});
