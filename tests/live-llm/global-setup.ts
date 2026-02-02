import { spawn, ChildProcess } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import net from 'net';

let serverProcess: ChildProcess | null = null;
let testDataDir: string | null = null;

async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Could not get port')));
      }
    });
    server.on('error', reject);
  });
}

async function waitForServer(url: string, maxAttempts = 60): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/api/storage/conversations`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep trying
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server did not become healthy');
}

export async function setup() {
  const port = await findAvailablePort();
  testDataDir = mkdtempSync(join(tmpdir(), 'fraude-test-'));

  console.log(`\n[Global Setup] Starting server on port ${port}...`);
  console.log(`[Global Setup] Using temp data dir: ${testDataDir}`);

  serverProcess = spawn(
    process.execPath,
    ['./node_modules/.bin/next', 'dev', '-p', String(port)],
    {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TEST_DATA_DIR: testDataDir,
      },
    }
  );

  // Wait for server to print ready message
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 60000);

    serverProcess!.stdout?.on('data', (data) => {
      const text = data.toString();
      if (text.includes('Ready') || text.includes('Local:') || text.includes('✓ Ready')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess!.stderr?.on('data', (data) => {
      console.error('[server:err]', data.toString().trim());
    });

    serverProcess!.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Wait for health check
  const serverUrl = `http://localhost:${port}`;
  await waitForServer(serverUrl);

  // Write server info to a file that tests can read
  const infoFile = join(testDataDir, 'server-info.json');
  writeFileSync(infoFile, JSON.stringify({ port, url: serverUrl, dataDir: testDataDir }));

  // Set env vars for tests to read
  process.env.TEST_SERVER_URL = serverUrl;
  process.env.TEST_SERVER_PORT = String(port);
  process.env.TEST_DATA_DIR = testDataDir;

  console.log(`[Global Setup] Server ready at ${serverUrl}\n`);
}

export async function teardown() {
  if (serverProcess) {
    console.log('\n[Global Teardown] Stopping server...');
    serverProcess.kill('SIGTERM');

    await new Promise<void>((resolve) => {
      serverProcess!.on('exit', () => {
        console.log('[Global Teardown] Server stopped');
        resolve();
      });
      setTimeout(() => {
        serverProcess?.kill('SIGKILL');
        resolve();
      }, 3000);
    });
  }

  if (testDataDir) {
    try {
      rmSync(testDataDir, { recursive: true, force: true });
      console.log(`[Global Teardown] Cleaned up: ${testDataDir}`);
    } catch (e) {
      console.warn(`[Global Teardown] Failed to clean up: ${e}`);
    }
  }
}
