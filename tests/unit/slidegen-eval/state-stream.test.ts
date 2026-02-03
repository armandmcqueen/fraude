import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateEventEmitterImpl } from '@/services/slidegen-eval';

/**
 * Tests for the SSE state-stream functionality.
 *
 * Note: The actual HTTP endpoint requires a running server.
 * These tests verify the core pub/sub mechanics that power the SSE stream.
 */
describe('State Stream (SSE) Integration', () => {
  let emitter: StateEventEmitterImpl;

  beforeEach(() => {
    emitter = new StateEventEmitterImpl();
  });

  describe('multiple client broadcast', () => {
    it('should broadcast events to all connected clients', () => {
      const client1Events: unknown[] = [];
      const client2Events: unknown[] = [];
      const client3Events: unknown[] = [];

      // Simulate 3 SSE clients connecting
      emitter.subscribe((event) => client1Events.push(event));
      emitter.subscribe((event) => client2Events.push(event));
      emitter.subscribe((event) => client3Events.push(event));

      // Clear connected events
      client1Events.length = 0;
      client2Events.length = 0;
      client3Events.length = 0;

      // Simulate a config update (like from API mutation)
      emitter.emit({
        type: 'config_updated',
        config: {
          id: 'default',
          systemPrompt: 'Updated prompt',
          version: 2,
          updatedAt: new Date(),
        },
      });

      // All clients should receive the event
      expect(client1Events).toHaveLength(1);
      expect(client2Events).toHaveLength(1);
      expect(client3Events).toHaveLength(1);

      expect(client1Events[0]).toMatchObject({ type: 'config_updated' });
      expect(client2Events[0]).toMatchObject({ type: 'config_updated' });
      expect(client3Events[0]).toMatchObject({ type: 'config_updated' });
    });

    it('should handle client disconnect during broadcast', () => {
      const client1Events: unknown[] = [];
      const client2Events: unknown[] = [];

      const { unsubscribe: unsub1 } = emitter.subscribe((event) => client1Events.push(event));
      emitter.subscribe((event) => client2Events.push(event));

      // Clear connected events
      client1Events.length = 0;
      client2Events.length = 0;

      // Client 1 disconnects
      unsub1();

      // Emit event
      emitter.emit({ type: 'test_case_deleted', testCaseId: 'tc-1' });

      // Only client 2 should receive
      expect(client1Events).toHaveLength(0);
      expect(client2Events).toHaveLength(1);
    });

    it('should handle rapid event emission', () => {
      const receivedEvents: unknown[] = [];
      emitter.subscribe((event) => receivedEvents.push(event));
      receivedEvents.length = 0; // Clear connected event

      // Simulate rapid test progress updates
      for (let i = 0; i < 100; i++) {
        emitter.emit({
          type: 'test_result_updated',
          result: {
            id: `r-${i}`,
            testCaseId: 'tc-1',
            configVersion: 1,
            enhancedPrompt: `Prompt ${i}`,
            status: 'enhancing',
            runStartedAt: new Date(),
          },
        });
      }

      expect(receivedEvents).toHaveLength(100);
    });
  });

  describe('event ordering', () => {
    it('should deliver events in order', () => {
      const events: { type: string; order: number }[] = [];

      emitter.subscribe((event) => {
        if ('order' in (event as { order?: number })) {
          events.push(event as { type: string; order: number });
        }
      });

      // Emit events with order markers
      for (let i = 0; i < 10; i++) {
        emitter.emit({ type: 'test_case_added', order: i, testCase: {} } as never);
      }

      // Verify order
      for (let i = 0; i < 10; i++) {
        expect(events[i].order).toBe(i);
      }
    });
  });

  describe('SSE format simulation', () => {
    it('should work with SSE-style event serialization', () => {
      const sseMessages: string[] = [];

      // Simulate SSE encoding like the route does
      const encoder = new TextEncoder();
      emitter.subscribe((event) => {
        const encoded = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
        sseMessages.push(new TextDecoder().decode(encoded));
      });

      emitter.emit({
        type: 'changelog_entry_added',
        entry: {
          id: 'cl-1',
          timestamp: new Date(),
          source: 'ui',
          action: 'config_updated',
          summary: 'Config updated',
        },
      });

      // Should have connected event + our event
      expect(sseMessages).toHaveLength(2);
      expect(sseMessages[1]).toMatch(/^data: \{.*"type":"changelog_entry_added".*\}\n\n$/);
    });
  });
});
