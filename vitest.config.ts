import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 60000, // 60s timeout for live LLM tests
    hookTimeout: 120000, // 2 min for beforeAll/afterAll (server startup)
    globalSetup: './tests/live-llm/global-setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
