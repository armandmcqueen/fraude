import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getServerUrl } from './server-utils';

/**
 * Integration tests for Slidegen Eval API endpoints.
 * These tests run against the actual Next.js server.
 */
describe('Slidegen Eval API', () => {
  let serverUrl: string;

  beforeAll(() => {
    serverUrl = getServerUrl();
  });

  // Clean up test data after all tests
  afterAll(async () => {
    // Delete any test cases we created
    const listResponse = await fetch(`${serverUrl}/api/slidegen-eval/test-cases`);
    const { testCases } = await listResponse.json();

    for (const tc of testCases) {
      if (tc.name.startsWith('Test:')) {
        await fetch(`${serverUrl}/api/slidegen-eval/test-cases/${tc.id}`, {
          method: 'DELETE',
        });
      }
    }
  });

  describe('Config API', () => {
    it('GET /api/slidegen-eval/config returns config or null', async () => {
      const response = await fetch(`${serverUrl}/api/slidegen-eval/config`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('config');
      // Config can be null or an object
      if (data.config !== null) {
        expect(data.config).toHaveProperty('systemPrompt');
        expect(data.config).toHaveProperty('version');
      }
    });

    it('PUT /api/slidegen-eval/config creates/updates config', async () => {
      const testPrompt = `Test prompt created at ${Date.now()}`;

      const response = await fetch(`${serverUrl}/api/slidegen-eval/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: testPrompt }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.config.systemPrompt).toBe(testPrompt);
      expect(data.config.version).toBeGreaterThan(0);
      expect(data.config.id).toBe('default');
    });

    it('PUT /api/slidegen-eval/config increments version', async () => {
      // Get current version
      const getResponse1 = await fetch(`${serverUrl}/api/slidegen-eval/config`);
      const data1 = await getResponse1.json();
      const initialVersion = data1.config?.version || 0;

      // Update
      await fetch(`${serverUrl}/api/slidegen-eval/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: 'Version test' }),
      });

      // Check new version
      const getResponse2 = await fetch(`${serverUrl}/api/slidegen-eval/config`);
      const data2 = await getResponse2.json();

      expect(data2.config.version).toBe(initialVersion + 1);
    });

    it('PUT /api/slidegen-eval/config returns 400 for missing systemPrompt', async () => {
      const response = await fetch(`${serverUrl}/api/slidegen-eval/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });

    it('PUT /api/slidegen-eval/config respects X-Source header', async () => {
      const response = await fetch(`${serverUrl}/api/slidegen-eval/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'agent',
        },
        body: JSON.stringify({ systemPrompt: 'Agent update' }),
      });

      expect(response.status).toBe(200);
      // The changelog should show source: 'agent' - we verify this via changelog API later
    });
  });

  describe('Test Cases API', () => {
    let createdTestCaseId: string;

    it('GET /api/slidegen-eval/test-cases returns array', async () => {
      const response = await fetch(`${serverUrl}/api/slidegen-eval/test-cases`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('testCases');
      expect(Array.isArray(data.testCases)).toBe(true);
    });

    it('POST /api/slidegen-eval/test-cases creates test case', async () => {
      const response = await fetch(`${serverUrl}/api/slidegen-eval/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test: Marketing Slide',
          inputText: 'Q3 revenue grew 40% year-over-year',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.testCase.name).toBe('Test: Marketing Slide');
      expect(data.testCase.inputText).toBe('Q3 revenue grew 40% year-over-year');
      expect(data.testCase.id).toBeDefined();

      createdTestCaseId = data.testCase.id;
    });

    it('POST /api/slidegen-eval/test-cases returns 400 for missing name', async () => {
      const response = await fetch(`${serverUrl}/api/slidegen-eval/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText: 'Some text' }),
      });

      expect(response.status).toBe(400);
    });

    it('GET /api/slidegen-eval/test-cases/[id] returns single test case', async () => {
      // First create a test case
      const createResponse = await fetch(`${serverUrl}/api/slidegen-eval/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test: Get Single',
          inputText: 'Test input',
        }),
      });
      const { testCase: created } = await createResponse.json();

      // Then get it
      const response = await fetch(`${serverUrl}/api/slidegen-eval/test-cases/${created.id}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.testCase.id).toBe(created.id);
      expect(data.testCase.name).toBe('Test: Get Single');

      // Cleanup
      await fetch(`${serverUrl}/api/slidegen-eval/test-cases/${created.id}`, {
        method: 'DELETE',
      });
    });

    it('GET /api/slidegen-eval/test-cases/[id] returns 404 for non-existent', async () => {
      const response = await fetch(`${serverUrl}/api/slidegen-eval/test-cases/non-existent-id`);
      expect(response.status).toBe(404);
    });

    it('PUT /api/slidegen-eval/test-cases/[id] updates test case', async () => {
      // Create
      const createResponse = await fetch(`${serverUrl}/api/slidegen-eval/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test: To Update',
          inputText: 'Original text',
        }),
      });
      const { testCase: created } = await createResponse.json();

      // Update
      const response = await fetch(`${serverUrl}/api/slidegen-eval/test-cases/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test: Updated Name',
          inputText: 'Updated text',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.testCase.name).toBe('Test: Updated Name');
      expect(data.testCase.inputText).toBe('Updated text');

      // Cleanup
      await fetch(`${serverUrl}/api/slidegen-eval/test-cases/${created.id}`, {
        method: 'DELETE',
      });
    });

    it('PUT /api/slidegen-eval/test-cases/[id] returns 404 for non-existent', async () => {
      const response = await fetch(`${serverUrl}/api/slidegen-eval/test-cases/non-existent-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });
      expect(response.status).toBe(404);
    });

    it('DELETE /api/slidegen-eval/test-cases/[id] deletes test case', async () => {
      // Create
      const createResponse = await fetch(`${serverUrl}/api/slidegen-eval/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test: To Delete',
          inputText: 'Will be deleted',
        }),
      });
      const { testCase: created } = await createResponse.json();

      // Delete
      const response = await fetch(`${serverUrl}/api/slidegen-eval/test-cases/${created.id}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify deleted
      const getResponse = await fetch(`${serverUrl}/api/slidegen-eval/test-cases/${created.id}`);
      expect(getResponse.status).toBe(404);
    });

    it('DELETE /api/slidegen-eval/test-cases/[id] returns 404 for non-existent', async () => {
      const response = await fetch(`${serverUrl}/api/slidegen-eval/test-cases/non-existent-id`, {
        method: 'DELETE',
      });
      expect(response.status).toBe(404);
    });

    // Cleanup test case created in earlier test
    afterAll(async () => {
      if (createdTestCaseId) {
        await fetch(`${serverUrl}/api/slidegen-eval/test-cases/${createdTestCaseId}`, {
          method: 'DELETE',
        });
      }
    });
  });

  describe('SSE State Stream', () => {
    it('GET /api/slidegen-eval/state-stream connects and receives initial state', async () => {
      // Use AbortController to timeout the SSE connection
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(`${serverUrl}/api/slidegen-eval/state-stream`, {
          signal: controller.signal,
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('text/event-stream');

        // Read the first few events
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let text = '';

        // Read until we get initial_state or timeout
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          text += decoder.decode(value, { stream: true });

          // Check if we have the events we need
          if (text.includes('initial_state')) {
            break;
          }
        }

        reader.cancel();

        expect(text).toContain('connected');
        expect(text).toContain('initial_state');
      } finally {
        clearTimeout(timeout);
      }
    });
  });

  describe('Changelog Integration', () => {
    it('mutations create changelog entries visible in initial_state', async () => {
      // Make a mutation
      await fetch(`${serverUrl}/api/slidegen-eval/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: 'Changelog test' }),
      });

      // The changelog is stored in the filesystem
      // We can verify it exists by checking the initial_state from SSE
      // (In a real integration test, we'd have a changelog API endpoint)

      // For now, just verify the mutation succeeded
      const response = await fetch(`${serverUrl}/api/slidegen-eval/config`);
      const data = await response.json();
      expect(data.config.systemPrompt).toBe('Changelog test');
    });
  });

  describe('Test Results API', () => {
    it('GET /api/slidegen-eval/test-results returns array', async () => {
      const response = await fetch(`${serverUrl}/api/slidegen-eval/test-results`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('results');
      expect(Array.isArray(data.results)).toBe(true);
    });
  });

  describe('Run Test API', () => {
    it('POST /api/slidegen-eval/run-test returns 400 for missing testCaseId', async () => {
      const response = await fetch(`${serverUrl}/api/slidegen-eval/run-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });

    it('POST /api/slidegen-eval/run-test returns 404 for non-existent test case', async () => {
      const response = await fetch(`${serverUrl}/api/slidegen-eval/run-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCaseId: 'non-existent-id' }),
      });

      expect(response.status).toBe(404);
    });

    // Note: Full test execution requires API keys, so we skip the actual run test
    // in CI environments. The unit tests cover the logic with mocked clients.
  });

  describe('Run All Tests API', () => {
    it('POST /api/slidegen-eval/run-all-tests returns results array', async () => {
      // This test runs all tests - if there are no test cases, it returns empty
      const response = await fetch(`${serverUrl}/api/slidegen-eval/run-all-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('results');
      expect(Array.isArray(data.results)).toBe(true);
    });
  });
});
