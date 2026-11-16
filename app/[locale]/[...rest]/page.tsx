import { notFound } from 'next/navigation';

/**
 * Catch-all for unknown paths under the Farsi locale, so every 404 renders the
 * localized `not-found.tsx` (HTTP 404 + noindex) instead of Next's default
 * English screen. Real routes are more specific and always win over this file.
 */
export default function CatchAllPage() {
  notFound();
}
