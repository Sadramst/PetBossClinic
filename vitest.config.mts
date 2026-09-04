import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 80,
        statements: 85
      }
    },
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
});
