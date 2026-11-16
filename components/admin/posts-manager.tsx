'use client'

import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { deletePostAction, savePostAction } from '@/app/actions/posts'

export interface AdminPost {
  id: string
  titleFa: string
  slugFa: string
  excerptFa: string | null
  contentFa: string | null
  imageId: string | null
  metaTitleFa: string | null
  metaDescriptionFa: string | null
  focusKeyword: string | null
  category: string
  published: boolean
  publishedAt: string | null
  updatedAt: string
}

const field = 'w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm'

export function PostsManager({ posts, categories }: { posts: AdminPost[]; categories: string[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<AdminPost | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (editing) {
    const p = editing === 'new' ? null : editing
    return (
      <form
        className="space-y-4 max-w-4xl"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          start(async () => {
            const res = await savePostAction(fd)
            if (res.error) return setError(res.error)
            setError(null)
            setEditing(null)
            router.refresh()
          })
        }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{p ? 'ویرایش مقاله' : 'مقاله جدید'}</h1>
          <button type="button" onClick={() => setEditing(null)} className="text-sm text-muted-foreground">بازگشت</button>
        </div>
        {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm px-4 py-3">{error}</p>}
        {p && <input type="hidden" name="id" value={p.id} />}
        <input name="titleFa" defaultValue={p?.titleFa} placeholder="عنوان مقاله" className={`${field} text-lg font-bold`} required />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs">
            <span>دسته</span>
            <input name="category" list="post-categories" defaultValue={p?.category ?? 'تغذیه'} className={field} />
            <datalist id="post-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="space-y-1 text-xs">
            <span>نشانی (slug) — خالی = از روی عنوان</span>
            <input name="slugFa" defaultValue={p?.slugFa} className={field} />
          </label>
          <label className="space-y-1 text-xs">
            <span>کلمه کلیدی اصلی (برای محصولات مرتبط)</span>
            <input name="focusKeyword" defaultValue={p?.focusKeyword ?? ''} placeholder="غذای خشک گربه" className={field} />
          </label>
        </div>
        <label className="block space-y-1 text-xs">
          <span>خلاصه (در فهرست مقالات و نتایج گوگل)</span>
          <textarea name="excerptFa" defaultValue={p?.excerptFa ?? ''} rows={2} className={field} />
        </label>
        <label className="block space-y-1 text-xs">
          <span>
            {'متن مقاله — «## » تیتر، «### » زیرتیتر، «- » فهرست، «> » نکته، **پررنگ**، [متن لینک](/shop/cat-dry-food)'}
          </span>
          <textarea name="contentFa" defaultValue={p?.contentFa ?? ''} rows={22} className={`${field} leading-8 font-[inherit]`} required />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="imageId" defaultValue={p?.imageId ?? ''} dir="ltr" placeholder="/images/veterinarian.jpg یا آدرس https" className={field} />
          <input name="metaTitleFa" defaultValue={p?.metaTitleFa ?? ''} placeholder="عنوان سئو (اختیاری، حداکثر ۷۰ نویسه)" className={field} />
        </div>
        <textarea name="metaDescriptionFa" defaultValue={p?.metaDescriptionFa ?? ''} rows={2} placeholder="توضیحات متا (اختیاری، حداکثر ۱۶۰ نویسه)" className={field} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="publish" defaultChecked={p?.published ?? false} />
          منتشر شود (در غیر این صورت پیش‌نویس می‌ماند)
        </label>
        <button disabled={pending} className="h-11 px-8 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-sm disabled:opacity-60">
          {pending ? 'در حال ذخیره…' : 'ذخیره مقاله'}
        </button>
      </form>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">مجله و مقالات</h1>
          <p className="text-sm text-muted-foreground mt-1">مقالات منتشرشده در /blog نمایش داده می‌شوند و برای گوگل نقشه سایت دارند.</p>
        </div>
        <button onClick={() => setEditing('new')} className="h-10 px-5 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-sm">
          + مقاله جدید
        </button>
      </div>
      <div className="rounded-2xl border border-border bg-surface-card divide-y divide-border">
        {posts.length === 0 && <p className="p-6 text-sm text-muted-foreground">هنوز مقاله‌ای نوشته نشده است.</p>}
        {posts.map((p) => (
          <div key={p.id} className="p-4 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-bold line-clamp-1">{p.titleFa}</p>
              <p className="text-xs text-muted-foreground mt-1">{p.category} · ویرایش: {p.updatedAt}</p>
            </div>
            <span className={`text-xs rounded-full px-2.5 py-1 ${p.published ? 'bg-emerald-500/15 text-emerald-300' : 'bg-surface text-muted-foreground'}`}>
              {p.published ? `منتشرشده ${p.publishedAt ?? ''}` : 'پیش‌نویس'}
            </span>
            {p.published && (
              <a href={`/blog/${encodeURIComponent(p.slugFa)}`} target="_blank" className="text-xs text-primary">مشاهده</a>
            )}
            <button onClick={() => setEditing(p)} className="text-xs text-primary">ویرایش</button>
            <button
              disabled={pending}
              onClick={() => confirm('این مقاله حذف شود؟') && start(async () => (await deletePostAction(p.id), router.refresh()))}
              className="text-xs text-red-400"
            >
              حذف
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
