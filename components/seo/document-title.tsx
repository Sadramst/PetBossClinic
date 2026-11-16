'use client';

import { useEffect } from 'react';

/**
 * Next.js resets the document title to the layout default when a `notFound()`
 * boundary hydrates (its metadata tree belongs to the layout, not the boundary).
 * This keeps the browser tab correct after hydration while the server-rendered
 * head already carries the localized 404 title.
 */
export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
  }, [title]);

  return null;
}

/**
 * Keeps the 404 document `noindex` after hydration: Next's head manager replays
 * the locale layout's `index, follow` robots metadata when the boundary mounts.
 */
export function DocumentRobots({ content = 'noindex, nofollow' }: { content?: string }) {
  useEffect(() => {
    document.querySelectorAll('meta[name="robots"]').forEach((el) => el.remove());
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
  }, [content]);

  return null;
}
