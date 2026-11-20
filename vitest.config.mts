import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Integration tests share one local database (counts, rate limits): run files one at a time.
    fileParallelism: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}', 'tests/integration/**/*.{test,spec}.ts', '__tests__/**/*.{test,spec}.tsx'],
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
});
