'use client';

import { useState } from 'react';
import { PetForm } from '@/components/account/pet-form';

/** «افزودن حیوان خانگی» button that reveals the form in place. */
export function PetAddPanel({ defaultOpen = false, disabledReason }: { defaultOpen?: boolean; disabledReason?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  if (disabledReason) return <p className="text-sm text-muted-foreground">{disabledReason}</p>;
  return (
    <div className="space-y-4">
      {!open && (
        <button data-testid="pet-add" onClick={() => setOpen(true)} aria-expanded={false} className="h-11 rounded-xl bg-gradient-gold px-6 text-sm font-bold text-charcoal-950">
          + افزودن حیوان خانگی
        </button>
      )}
      {open && (
        <div className="rounded-2xl border border-primary/40 bg-surface-card p-4 sm:p-5">
          <h2 className="mb-4 font-extrabold">حیوان خانگی جدید</h2>
          <PetForm onDone={(id) => { if (!id) setOpen(false); }} />
        </div>
      )}
    </div>
  );
}
