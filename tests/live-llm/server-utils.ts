/**
 * Server utilities for live-llm tests.
 *
 * The server is started once by global-setup.ts before all tests run.
 * These functions provide access to the shared server URL and test data directory.
 */

/**
 * Get the base URL for the test server.
 * The server is started by global-setup.ts.
 */
export function getServerUrl(): string {
  const url = process.env.TEST_SERVER_URL;
  if (!url) {
    throw new Error('TEST_SERVER_URL not set - global setup may have failed');
  }
  return url;
}

/**
 * Get the temp data directory for this test run.
 */
export function getTestDataDir(): string {
  const dir = process.env.TEST_DATA_DIR;
  if (!dir) {
    throw new Error('TEST_DATA_DIR not set - global setup may have failed');
  }
  return dir;
}

/**
 * No-op for backwards compatibility.
 * Server is now started by global setup.
 */
export async function startServer(): Promise<void> {
  // Server is started by global-setup.ts
}

/**
 * No-op for backwards compatibility.
 * Server is now stopped by global teardown.
 */
export async function stopServer(): Promise<void> {
  // Server is stopped by global-setup.ts teardown
}

/**
 * No-op for backwards compatibility.
 * Server health is checked by global setup.
 */
export async function waitForServer(): Promise<void> {
  // Server health is verified by global-setup.ts
}
