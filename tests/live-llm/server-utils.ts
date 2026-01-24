import { spawn, ChildProcess } from 'child_process';

let serverProcess: ChildProcess | null = null;
const SERVER_PORT = 3939; // Use non-standard port for tests
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

/**
 * Start the Next.js dev server for testing.
 * Returns when the server is ready to accept requests.
 */
export async function startServer(): Promise<void> {
  if (serverProcess) {
    return; // Already running
  }

  return new Promise((resolve, reject) => {
    console.log(`Starting Next.js server on port ${SERVER_PORT}...`);

    // Use execPath to avoid shell
    serverProcess = spawn(
      process.execPath,
      ['./node_modules/.bin/next', 'dev', '-p', String(SERVER_PORT)],
      {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      }
    );

    let resolved = false;

    const resolveOnce = () => {
      if (!resolved) {
        resolved = true;
        console.log('Server startup detected, waiting for health check...');
        // Give it a moment then resolve - health check will verify
        setTimeout(resolve, 2000);
      }
    };

    serverProcess.stdout?.on('data', (data) => {
      const text = data.toString().trim();
      // Filter out empty lines and ANSI escape codes
      const visibleText = text.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').trim();
      if (visibleText) {
        console.log('[server]', text);
      }
      // Next.js prints various ready indicators
      if (
        text.includes('Ready') ||
        text.includes('Local:') ||
        text.includes('✓ Ready') ||
        text.includes('started server')
      ) {
        resolveOnce();
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error('[server:err]', data.toString().trim());
    });

    serverProcess.on('error', (err) => {
      reject(new Error(`Failed to start server: ${err.message}`));
    });

    serverProcess.on('exit', (code) => {
      if (!resolved && code !== 0 && code !== null) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Timeout if server doesn't start in 30 seconds
    setTimeout(() => {
      if (!resolved) {
        reject(new Error('Server startup timed out'));
      }
    }, 30000);
  });
}

/**
 * Stop the test server.
 */
export async function stopServer(): Promise<void> {
  if (!serverProcess) {
    return;
  }

  return new Promise((resolve) => {
    console.log('Stopping server...');

    const proc = serverProcess;
    serverProcess = null;

    proc!.on('exit', () => {
      console.log('Server stopped');
      resolve();
    });

    // Try graceful shutdown
    proc!.kill('SIGTERM');

    // Force kill after 3 seconds
    setTimeout(() => {
      if (!proc!.killed) {
        proc!.kill('SIGKILL');
        resolve();
      }
    }, 3000);
  });
}

/**
 * Get the base URL for the test server.
 */
export function getServerUrl(): string {
  return SERVER_URL;
}

/**
 * Wait for server to be healthy by polling an endpoint.
 */
export async function waitForServer(maxAttempts = 60): Promise<void> {
  console.log('Waiting for server to be healthy...');

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${SERVER_URL}/api/storage/conversations`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        console.log('Server is healthy');
        return;
      }
      console.log(`Health check attempt ${i + 1}: status ${response.status}`);
    } catch (e) {
      if (i % 5 === 0) {
        console.log(`Health check attempt ${i + 1}: ${(e as Error).message}`);
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server did not become healthy');
}
