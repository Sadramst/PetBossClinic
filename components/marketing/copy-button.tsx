'use client';

import { useState } from 'react';

export function CopyButton({ text, label = 'کپی کد', className = '' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers / insecure context: fall back to a hidden textarea.
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        return;
      }
    }
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };
  return (
    <button type="button" data-testid="coupon-copy" onClick={copy} className={`btn btn-outline btn-sm ${className}`}>
      <span aria-live="polite">{done ? 'کپی شد' : label}</span>
    </button>
  );
}
