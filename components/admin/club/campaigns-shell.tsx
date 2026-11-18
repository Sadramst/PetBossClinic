'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CampaignWizard } from '@/components/admin/club/campaign-wizard'

export function CampaignsShell({ segments, tiers, initialSegmentId }: { segments: { id: string; name: string }[]; tiers: { key: string; label: string }[]; initialSegmentId?: string }) {
  const [open, setOpen] = useState(!!initialSegmentId)
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">کمپین‌های پیامکی</h1>
          <p className="mt-1 text-sm text-muted-foreground">مخاطب را انتخاب کنید، متن شخصی‌سازی‌شده و کد تخفیف اختصاصی بسازید و ارسال کنید.</p>
        </div>
        {!open && <Button variant="gold" size="sm" onClick={() => setOpen(true)} data-testid="campaign-new">کمپین جدید</Button>}
      </div>
      {open && <CampaignWizard segments={segments} tiers={tiers} initialSegmentId={initialSegmentId} onClose={() => setOpen(false)} />}
    </>
  )
}
