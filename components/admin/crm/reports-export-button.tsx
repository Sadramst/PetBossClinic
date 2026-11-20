'use client'

import { useState } from 'react'
import { exportReportCsvAction } from '@/app/actions/crm-reports'
import { Button } from '@/components/ui'

export function ReportsExportButton({ tab, days }: { tab: string; days: number }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function run() {
    setBusy(true)
    setErr('')
    const r = await exportReportCsvAction(tab, days)
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${tab}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={busy} data-testid="report-export">
        {busy ? 'در حال آماده‌سازی…' : 'خروجی CSV'}
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </span>
  )
}
