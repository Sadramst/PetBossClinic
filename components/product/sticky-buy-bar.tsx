'use client';

import { useEffect, useState } from 'react';

/**
 * Phone-only buy bar that sits above the bottom navigation. It appears only while the
 * real buy controls (`watchId`) are off screen, and steps aside once the end of the
 * page content (`endId`) is reached so it never covers the footer.
 */
export function StickyBuyBar({
  watchId,
  endId,
  children,
}: {
  watchId: string;
  endId: string;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const watch = document.getElementById(watchId);
    const end = document.getElementById(endId);
    if (!watch || typeof IntersectionObserver === 'undefined') {
      setShow(true);
      return;
    }
    let buyVisible = true;
    let ended = false;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === watch) buyVisible = entry.isIntersecting;
        else ended = entry.isIntersecting || entry.boundingClientRect.top < 0;
      }
      setShow(!buyVisible && !ended);
    });
    io.observe(watch);
    if (end) io.observe(end);
    return () => io.disconnect();
  }, [watchId, endId]);

  return (
    <div
      inert={!show}
      className={`bottom-above-nav fixed inset-x-0 z-40 border-t border-border bg-surface/95 px-4 py-2 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur transition-[transform,opacity] duration-200 lg:hidden ${
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'
      }`}
    >
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
