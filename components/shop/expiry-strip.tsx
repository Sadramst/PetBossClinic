import type { StripModel } from '@/lib/shop/expiry-strip';

/**
 * The single place a product page shows expiry (data-testid="product-expiry", exactly one per page).
 * Server component, fixed-height-free but rendered in the initial HTML, so no layout shift.
 */
export function ExpiryStrip({ model }: { model: StripModel }) {
  if (model.kind === 'none') return null;

  if (model.kind === 'unverified') {
    return (
      <div data-testid="product-expiry" className="rounded-xl border border-border bg-surface px-4 py-3 text-xs leading-6 text-muted-foreground">
        <span className="font-bold text-foreground">تاریخ انقضا: </span>
        {model.text}
      </div>
    );
  }

  return (
    <div
      data-testid="product-expiry"
      data-state={model.state}
      className={`rounded-xl border px-4 py-3 text-sm ${model.near ? 'border-primary/40 bg-primary/5' : 'border-border bg-surface'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-muted-foreground">تاریخ انقضا</span>
        <span className="flex flex-wrap items-center gap-2">
          {model.near && (
            <span
              data-testid="product-expiry-badge"
              className="inline-flex h-6 items-center rounded-full bg-primary/15 px-2.5 text-[11px] font-extrabold leading-none text-primary"
            >
              تاریخ نزدیک
            </span>
          )}
          <b>{model.dateText}</b>
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {model.relativeText}
        {model.note ? ` · ${model.note}` : ''}
      </p>
    </div>
  );
}
