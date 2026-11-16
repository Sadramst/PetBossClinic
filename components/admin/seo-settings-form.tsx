'use client'

import { useState, useTransition } from 'react'
import { updateSeoSettingsAction } from '@/app/actions/seo'

interface Props {
  initial: { gscVerification: string | null; bingId: string | null; ga4Id: string | null } | null
}

export function SeoSettingsForm({ initial }: Props) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <form
      className="rounded-2xl border border-border bg-surface-card p-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
          const res = await updateSeoSettingsAction(fd)
          setMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: 'تنظیمات گوگل ذخیره شد.' })
        })
      }}
    >
      <div>
        <h2 className="text-lg font-bold">گوگل و سئو</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-6">
          در Google Search Console روش تأیید «HTML tag» را انتخاب کنید و کل تگ یا فقط مقدار content را اینجا بچسبانید.
          سپس در سرچ کنسول آدرس نقشه سایت را ثبت کنید: <span dir="ltr">https://www.petbossclinic.com/sitemap.xml</span>
        </p>
      </div>

      <label className="block text-sm space-y-1.5">
        <span>کد تأیید Google Search Console</span>
        <input
          name="gscVerification"
          dir="ltr"
          defaultValue={initial?.gscVerification ?? ''}
          placeholder='<meta name="google-site-verification" content="..." />'
          className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm"
        />
      </label>
      <label className="block text-sm space-y-1.5">
        <span>شناسه Google Analytics 4</span>
        <input
          name="ga4Id"
          dir="ltr"
          defaultValue={initial?.ga4Id ?? ''}
          placeholder="G-XXXXXXXXXX"
          className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm"
        />
      </label>
      <label className="block text-sm space-y-1.5">
        <span>کد تأیید Bing Webmaster (اختیاری)</span>
        <input
          name="bingId"
          dir="ltr"
          defaultValue={initial?.bingId ?? ''}
          placeholder='<meta name="msvalidate.01" content="..." />'
          className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-gradient-gold text-charcoal-950 font-bold px-6 py-2.5 text-sm disabled:opacity-60"
        >
          {isPending ? 'در حال ذخیره…' : 'ذخیره'}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </form>
  )
}
