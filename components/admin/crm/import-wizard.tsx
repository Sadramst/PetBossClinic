'use client'

import { useRef, useState, useTransition } from 'react'
import { Link } from '@/i18n/routing'
import { PageHeader, StatusBadge, StatCard } from '@/components/admin/kit'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { previewImportAction, commitImportAction, type ImportPreview } from '@/app/actions/crm-data'
import { faNum } from '@/lib/crm/labels'

const TEMPLATE = '﻿phone,name,email,city,birthDate,tags,notes\r\n09121234567,سارا احمدی,sara@example.com,تهران,1375/04/09,سگ|vip,مشتری حضوری\r\n'
const MAX_BYTES = 1_500_000

type Step = 'pick' | 'preview' | 'done'

/** Three steps: choose the CSV, review an exact preview (new, duplicate, invalid), confirm. */
export function ImportWizard() {
  const [step, setStep] = useState<Step>('pick')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const input = useRef<HTMLInputElement>(null)

  async function onFile(f: File | undefined) {
    setError(null)
    if (!f) return
    if (f.size > MAX_BYTES) return void setError('حجم فایل بیش از ۱٫۵ مگابایت است؛ آن را به چند فایل تقسیم کنید.')
    setFileName(f.name)
    setText(await f.text())
  }

  function runPreview() {
    setError(null)
    start(async () => {
      const r = await previewImportAction(text)
      if (!r.ok) return void setError(r.error)
      setPreview(r.data)
      setStep('preview')
    })
  }

  async function commit() {
    if (!preview) return
    const ok = await confirmDialog({
      title: `${faNum(preview.valid)} مشتری جدید ساخته شود؟`,
      description: 'ردیف‌های تکراری و نامعتبر نادیده گرفته می‌شوند. ساختن دوبارهٔ همین فایل مشتری تکراری نمی‌سازد.',
      tone: 'default',
      confirmLabel: 'ورود مشتریان',
    })
    if (!ok) return
    start(async () => {
      const r = await commitImportAction(text)
      if (!r.ok) return void setError(r.error)
      setResult(r.data)
      setStep('done')
      toast.success('ورود مشتریان انجام شد')
    })
  }

  function reset() {
    setStep('pick')
    setText('')
    setFileName('')
    setPreview(null)
    setResult(null)
    setError(null)
    if (input.current) input.current.value = ''
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'customers-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const newRows = preview ? preview.valid : 0

  return (
    <div className="space-y-5" data-testid="import-wizard">
      <PageHeader
        title="ورود مشتریان از فایل"
        subtitle="یک فایل CSV بدهید؛ پیش از ثبت، همهٔ ردیف‌ها بررسی و پیش‌نمایش می‌شوند."
        breadcrumbs={[{ label: 'مشتریان', href: '/admin/customers' }, { label: 'ورود از فایل' }]}
        actions={
          <Button variant="secondary" size="sm" onClick={downloadTemplate} data-testid="import-template">
            دانلود فایل نمونه
          </Button>
        }
      />

      <ol className="flex flex-wrap gap-2 text-xs font-bold" aria-label="مراحل">
        {([['pick', '۱. انتخاب فایل'], ['preview', '۲. بررسی'], ['done', '۳. پایان']] as const).map(([k, l]) => (
          <li key={k} aria-current={step === k ? 'step' : undefined} className={`rounded-full border px-3 py-1.5 ${step === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
            {l}
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500" data-testid="import-error">
          {error}
        </p>
      )}

      {step === 'pick' && (
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm leading-7 text-muted-foreground">
            ستون «phone» یا «موبایل» الزامی است. ستون‌های اختیاری: نام، ایمیل، شهر، تاریخ تولد (شمسی مثل ۱۳۷۵/۰۴/۰۹)، برچسب‌ها (با | جدا کنید) و یادداشت. حداکثر ۵٬۰۰۰ ردیف.
          </p>
          <input ref={input} type="file" accept=".csv,text/csv,text/plain" onChange={(e) => void onFile(e.target.files?.[0])} aria-label="فایل CSV" className="block w-full text-sm" data-testid="import-file" />
          {fileName && <p className="text-xs text-muted-foreground">فایل انتخاب‌شده: {fileName}</p>}
          <Button variant="gold" disabled={pending || !text.trim()} onClick={runPreview} data-testid="import-preview">
            بررسی فایل
          </Button>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="import-summary">
            <StatCard statKey="new" label="مشتری جدید" value={faNum(newRows)} tone="ok" />
            <StatCard statKey="dup" label="تکراری (نادیده)" value={faNum(preview.duplicates)} tone="warn" />
            <StatCard statKey="invalid" label="نامعتبر" value={faNum(preview.invalid + preview.errors.length)} tone={preview.errors.length ? 'danger' : 'neutral'} />
            <StatCard statKey="total" label="کل ردیف‌ها" value={faNum(preview.total)} />
          </div>
          {preview.truncated && <p className="text-xs text-amber-500">فقط ۵٬۰۰۰ ردیف نخست پردازش می‌شود.</p>}

          {preview.errors.length > 0 && (
            <section className="rounded-2xl border border-red-500/30 p-4" data-testid="import-errors">
              <h3 className="mb-2 text-sm font-extrabold">ردیف‌های دارای مشکل</h3>
              <ul className="max-h-48 space-y-1 overflow-auto text-xs">
                {preview.errors.map((e) => (
                  <li key={`${e.line}-${e.message}`}>
                    سطر {faNum(e.line)}: {e.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm" data-testid="import-preview-table">
              <caption className="sr-only">پیش‌نمایش ردیف‌ها</caption>
              <thead className="bg-surface-elevated text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">موبایل</th>
                  <th className="p-2 text-start">نام</th>
                  <th className="p-2 text-start">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.index} className="border-t border-border" data-testid="import-row">
                    <td dir="ltr" className="p-2 text-start">{r.phone}</td>
                    <td className="p-2">{r.name || '—'}</td>
                    <td className="p-2">
                      {r.status === 'NEW' ? <StatusBadge tone="success">جدید</StatusBadge> : <StatusBadge tone="warning">تکراری</StatusBadge>}
                      {r.emailDropped && <span className="ms-2 text-[11px] text-muted-foreground">ایمیل تکراری حذف شد</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length < preview.valid && <p className="text-xs text-muted-foreground">فقط {faNum(preview.rows.length)} ردیف نخست نمایش داده شد.</p>}

          <div className="flex flex-wrap gap-2">
            <Button variant="gold" disabled={pending || newRows === 0} onClick={commit} data-testid="import-commit">
              ورود {faNum(newRows)} مشتری
            </Button>
            <Button variant="ghost" onClick={reset}>
              انتخاب فایل دیگر
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-3 rounded-2xl border border-border-gold p-5" data-testid="import-done">
          <p className="text-lg font-extrabold">{faNum(result.created)} مشتری جدید ساخته شد</p>
          <p className="text-sm text-muted-foreground">{faNum(result.skipped)} ردیف تکراری یا نامعتبر نادیده گرفته شد.</p>
          <div className="flex gap-2">
            <Link href="/admin/customers" className="btn btn-gold btn-sm">
              فهرست مشتریان
            </Link>
            <Button variant="ghost" size="sm" onClick={reset}>
              ورود فایل دیگر
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
