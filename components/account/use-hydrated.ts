'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False while the page is server-rendered, true once React has taken over.
 * Forms that hold secrets keep their submit button disabled until then: a submit
 * before hydration would be a plain browser form submit (and could put a password
 * into the URL) instead of going through the server action.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
