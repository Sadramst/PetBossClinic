'use client'

import { useEffect, useId, useRef, useState } from 'react'

export interface ProductOption {
  id: string
  name: string
  sku?: string | null
  barcode?: string | null
}

export interface ProductComboboxProps {
  value: ProductOption | null
  onChange: (product: ProductOption | null) => void
  /** Async search, e.g. `searchProductsAction`. Injected so the kit has no server imports. */
  search: (q: string) => Promise<ProductOption[]>
  placeholder?: string
  label?: string
  disabled?: boolean
}

const RECENT_KEY = 'admin:product-recents'

function readRecents(): ProductOption[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const arr = raw ? (JSON.parse(raw) as ProductOption[]) : []
    return Array.isArray(arr) ? arr.slice(0, 5) : []
  } catch {
    return []
  }
}
function pushRecent(p: ProductOption) {
  try {
    const next = [p, ...readRecents().filter((r) => r.id !== p.id)].slice(0, 5)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* private mode: recents are a convenience only */
  }
}

/** Search-as-you-type product picker with name, SKU, barcode and the last picks. */
export function ProductCombobox({ value, onChange, search, placeholder = 'نام، کد یا بارکد محصول', label = 'محصول', disabled }: ProductComboboxProps) {
  const id = useId()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ProductOption[]>([])
  const [recents, setRecents] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const seq = useRef(0)

  useEffect(() => {
    if (!open) return
    setRecents(readRecents())
    const text = q.trim()
    if (text.length < 2) {
      setItems([])
      return
    }
    const mine = ++seq.current
    setLoading(true)
    const t = setTimeout(() => {
      search(text)
        .then((r) => {
          if (mine === seq.current) setItems(r.slice(0, 10))
        })
        .catch(() => {
          if (mine === seq.current) setItems([])
        })
        .finally(() => {
          if (mine === seq.current) setLoading(false)
        })
    }, 250)
    return () => clearTimeout(t)
  }, [q, open, search])

  const list = q.trim().length >= 2 ? items : recents
  useEffect(() => setActive(0), [list.length, q])

  const pick = (p: ProductOption) => {
    pushRecent(p)
    onChange(p)
    setOpen(false)
    setQ('')
  }

  if (value && !open) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{value.name}</span>
          {(value.sku || value.barcode) && <span className="ltr-nums block truncate text-[11px] text-muted-foreground" dir="ltr">{[value.sku, value.barcode].filter(Boolean).join(' · ')}</span>}
        </span>
        <button type="button" disabled={disabled} onClick={() => onChange(null)} className="btn btn-ghost btn-sm">
          تغییر
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-xs font-bold">
        {label}
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && list[active] ? `${id}-opt-${list[active].id}` : undefined}
        autoComplete="off"
        disabled={disabled}
        value={q}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, Math.max(0, list.length - 1)))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && open && list[active]) {
            e.preventDefault()
            pick(list[active])
          } else if (e.key === 'Escape') setOpen(false)
        }}
        className="field"
      />
      {open && (
        <ul id={`${id}-list`} role="listbox" aria-label={label} className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface-elevated shadow-2xl">
          {q.trim().length < 2 && recents.length > 0 && <li role="presentation" className="px-3 pt-2 text-[11px] font-bold text-muted-foreground">آخرین انتخاب‌ها</li>}
          {loading && <li role="presentation" className="px-3 py-2 text-xs text-muted-foreground">در حال جست‌وجو…</li>}
          {!loading && list.length === 0 && (
            <li role="presentation" className="px-3 py-3 text-xs text-muted-foreground">{q.trim().length < 2 ? 'دست‌کم دو حرف بنویسید.' : 'محصولی پیدا نشد.'}</li>
          )}
          {list.map((p, i) => (
            <li
              key={p.id}
              id={`${id}-opt-${p.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(p)
              }}
              className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-primary/10' : ''}`}
            >
              <span className="block truncate text-sm font-bold">{p.name}</span>
              {(p.sku || p.barcode) && <span className="ltr-nums block truncate text-[11px] text-muted-foreground" dir="ltr">{[p.sku, p.barcode].filter(Boolean).join(' · ')}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
