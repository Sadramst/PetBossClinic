'use client'

import { useEffect } from 'react'
import { Link } from '@/i18n/routing'
import { EmptyState } from '@/components/admin/kit'

/** Persian error boundary for every admin page: the shell stays visible. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="p-4 sm:p-6" data-testid="admin-error">
      <EmptyState
        title="این صفحه بارگذاری نشد"
        description="مشکلی پیش آمد و اطلاعات این بخش در دسترس نیست. دوباره تلاش کنید؛ اگر ادامه داشت، چند دقیقه بعد سر بزنید."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={reset} className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
              تلاش دوباره
            </button>
            <Link href="/admin" className="inline-flex h-11 items-center rounded-xl border border-border px-5 text-sm font-bold">
              بازگشت به پیشخوان
            </Link>
          </div>
        }
      />
    </div>
  )
}
