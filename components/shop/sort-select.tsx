'use client';

import { useRouter } from '@/i18n/routing';
import { SORT_LABELS, type SortKey } from '@/lib/shop/filters';

/** Sort dropdown: navigates to the same listing with a new sort (resets to page 1). */
export function SortSelect({ value, hrefFor }: { value: SortKey; hrefFor: Record<SortKey, string> }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground whitespace-nowrap">مرتب‌سازی:</span>
      <select
        value={value}
        onChange={(e) => router.push(hrefFor[e.target.value as SortKey])}
        className="rounded-xl border border-border bg-input px-3 py-2 text-sm"
      >
        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
          <option key={k} value={k}>
            {SORT_LABELS[k]}
          </option>
        ))}
      </select>
    </label>
  );
}
