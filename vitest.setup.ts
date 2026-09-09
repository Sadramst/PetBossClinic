import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { webcrypto } from 'node:crypto';

// Ensure Web Crypto API is available in JSDOM environment
if (!globalThis.crypto?.subtle) {
  // @ts-expect-error polyfill webcrypto in jsdom
  globalThis.crypto = webcrypto;
}

// Run cleanup after each test
afterEach(() => {
  cleanup();
});
