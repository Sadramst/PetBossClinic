'use client'

import { cancelCampaignAction } from '@/app/actions/admin-club'
import { Button } from '@/components/ui/button'
import { useAct } from '@/components/admin/club/kit'

export function CancelCampaignButton({ id }: { id: string }) {
  const { run, pending } = useAct()
  return (
    <Button
      variant="dangerOutline"
      size="sm"
      disabled={pending}
      data-testid="campaign-cancel"
      onClick={() =>
        run(() => cancelCampaignAction(id), {
          confirm: { title: 'لغو کمپین؟', description: 'پیام‌هایی که هنوز ارسال نشده‌اند لغو و کدهای تخفیف استفاده‌نشده‌ی آن‌ها غیرفعال می‌شود. پیام‌های ارسال‌شده بازگشت‌پذیر نیستند.', confirmLabel: 'لغو کمپین' },
          ok: 'کمپین لغو شد',
        })
      }
    >
      لغو کمپین
    </Button>
  )
}
