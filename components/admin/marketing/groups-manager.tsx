'use client'

import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/toaster'
import {
  addGroupMembersAction,
  createGroupAction,
  deleteGroupAction,
  getGroupMembersAction,
  removeGroupMemberAction,
  updateGroupAction,
  type GroupMemberRow,
} from '@/app/actions/admin-marketing'
import { faNum } from '@/components/admin/format'

export interface GroupRow {
  id: string
  name: string
  description: string | null
  members: number
  coupons: number
}

function GroupCard({ g }: { g: GroupRow }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<GroupMemberRow[] | null>(null)
  const [text, setText] = useState('')
  const [note, setNote] = useState<{ tone: 'success' | 'error' | 'warning'; text: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(g.name)
  const [desc, setDesc] = useState(g.description ?? '')

  const load = () =>
    start(async () => {
      const res = await getGroupMembersAction(g.id)
      setMembers(res.data?.members ?? [])
    })

  const toggle = () => {
    if (!open && members === null) load()
    setOpen((v) => !v)
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    start(async () => {
      const res = await addGroupMembersAction(g.id, text)
      if (!res.ok || !res.data) {
        setNote({ tone: 'error', text: res.error ?? 'افزودن انجام نشد.' })
        return
      }
      const { added, already, missing } = res.data
      const parts = [`${faNum(added)} نفر اضافه شد`]
      if (already) parts.push(`${faNum(already)} نفر از قبل عضو بودند`)
      if (missing.length) parts.push(`${faNum(missing.length)} مورد مشتری ثبت‌نام‌شده نبود: ${missing.slice(0, 5).join('، ')}`)
      setNote({ tone: missing.length && !added ? 'warning' : 'success', text: parts.join(' · ') })
      if (added) setText('')
      const fresh = await getGroupMembersAction(g.id)
      setMembers(fresh.data?.members ?? [])
      router.refresh()
    })
  }

  const remove = (m: GroupMemberRow) =>
    start(async () => {
      const res = await removeGroupMemberAction(g.id, m.customerId)
      if (!res.ok) return void toast.error('حذف نشد', res.error)
      setMembers((prev) => (prev ?? []).filter((x) => x.customerId !== m.customerId))
      router.refresh()
    })

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    start(async () => {
      const res = await updateGroupAction(g.id, { name, description: desc })
      if (!res.ok) return void toast.error('ذخیره نشد', res.error)
      toast.success('گروه به‌روز شد')
      setEditing(false)
      router.refresh()
    })
  }

  const del = () =>
    start(async () => {
      const ok = await confirmDialog({ title: `حذف گروه «${g.name}»؟`, description: 'اعضای گروه از آن خارج می‌شوند؛ خود مشتریان حذف نمی‌شوند.', confirmLabel: 'حذف گروه' })
      if (!ok) return
      const res = await deleteGroupAction(g.id)
      if (!res.ok) return void toast.error('حذف نشد', res.error)
      toast.success('گروه حذف شد')
      router.refresh()
    })

  return (
    <li className="rounded-2xl border border-border bg-surface-card p-4" data-testid="group-card" data-name={g.name}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-extrabold">{g.name}</h3>
          {g.description && <p className="mt-0.5 text-sm text-muted-foreground">{g.description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            <span data-testid="group-count">{faNum(g.members)}</span> عضو · {faNum(g.coupons)} کد تخفیف وابسته
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" onClick={toggle} aria-expanded={open} data-testid="group-manage">
            {open ? 'بستن' : 'اعضا'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
            ویرایش
          </Button>
          <Button size="sm" variant="dangerOutline" disabled={pending} onClick={del} data-testid="group-delete">
            حذف
          </Button>
        </div>
      </div>

      {editing && (
        <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="نام گروه" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
          <Field label="توضیح" optional>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="gold" size="sm" loading={pending}>
              ذخیره
            </Button>
          </div>
        </form>
      )}

      {open && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <form onSubmit={add} className="space-y-2">
            <Field label="افزودن عضو" hint="موبایل یا ایمیل مشتریان ثبت‌نام‌شده؛ چند مورد را با خط جدید یا فاصله جدا کنید.">
              <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} dir="ltr" placeholder="09123456789" data-testid="group-add-input" />
            </Field>
            <Button type="submit" size="sm" variant="gold" loading={pending} disabled={!text.trim()} data-testid="group-add-submit">
              افزودن به گروه
            </Button>
          </form>
          {note && <Alert tone={note.tone} data-testid="group-note">{note.text}</Alert>}
          {members === null ? (
            <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">این گروه هنوز عضوی ندارد.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border" data-testid="group-members">
              {members.map((m) => (
                <li key={m.customerId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold">{m.name}</span>
                    <span className="ms-2 text-xs text-muted-foreground" dir="ltr">
                      {m.phone}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(m)} aria-label={`حذف ${m.name} از گروه`}>
                    حذف
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

export function GroupsManager({ groups }: { groups: GroupRow[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await createGroupAction({ name, description: desc })
      if (!res.ok) return void setError(res.error ?? 'ساخت گروه انجام نشد.')
      toast.success('گروه ساخته شد')
      setName('')
      setDesc('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="grid gap-3 rounded-2xl border border-border bg-surface-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
        <Field label="نام گروه جدید" required error={error ?? undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="مثلاً مشتریان ویژه" data-testid="group-name" />
        </Field>
        <Field label="توضیح" optional>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} />
        </Field>
        <Button type="submit" variant="gold" loading={pending} data-testid="group-create">
          ساخت گروه
        </Button>
      </form>

      {groups.length === 0 ? (
        <EmptyState variant="card" title="هنوز گروهی ندارید" description="گروه بسازید و در فرم کد تخفیف، کد را مخصوص آن گروه کنید." />
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <GroupCard key={g.id} g={g} />
          ))}
        </ul>
      )}
    </div>
  )
}
