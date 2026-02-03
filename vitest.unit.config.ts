import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for unit tests that don't require a server.
 * Run with: npx vitest --config vitest.unit.config.ts
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10000, // 10s should be plenty for unit tests
    include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
    // No globalSetup - unit tests don't need a server
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
