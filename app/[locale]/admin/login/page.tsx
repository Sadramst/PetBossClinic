'use client'

import React, { useState, useTransition } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import { PetBossLogo } from '@/components/shared/pet-boss-logo'
import { loginAction } from '@/app/actions/auth'

export default function AdminLoginPage() {
  const t = useTranslations('Admin')
  const locale = useLocale()
  const isEn = locale === 'en'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData()
    formData.append('email', email)
    formData.append('password', password)
    formData.append('locale', locale)

    startTransition(async () => {
      const res = await loginAction(undefined, formData)
      if (res?.error) {
        setError(res.error)
      }
    })
  }

  const fillCredentials = (userEmail: string, userPass: string) => {
    setEmail(userEmail)
    setPassword(userPass)
    setError(null)
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-[#121418] text-[#F3F4F6] relative overflow-hidden">
      {/* Subtle luxury glow effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Language Switcher */}
      <div className="absolute top-6 end-6">
        <Link
          href="/admin/login"
          locale={isEn ? 'fa' : 'en'}
          className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-surface/80 text-foreground hover:border-primary transition-colors font-medium backdrop-blur"
        >
          {isEn ? 'فارسی' : 'English'}
        </Link>
      </div>

      <div className="w-full max-w-md z-10">
        {/* Logo Card */}
        <div className="flex flex-col items-center mb-8 text-center">
          <Link href="/" className="mb-4">
            <PetBossLogo size="lg" variant="gold" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-foreground mt-2">
            {t('login')}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-[#181A20] border border-primary/25 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                {t('email')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="superadmin@petboss.com"
                className="w-full px-4 py-2.5 rounded-xl bg-[#121418] border border-border focus:border-primary focus:ring-1 focus:ring-primary text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                {t('password')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-[#121418] border border-border focus:border-primary focus:ring-1 focus:ring-primary text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all"
                dir="ltr"
              />
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={isPending}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-primary to-[#DFC07A] text-charcoal-950 font-bold text-sm hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 shadow-gold cursor-pointer"
            >
              {isPending ? t('loggingIn') : t('loginButton')}
            </button>
          </form>

          {/* Preset Roles Demo / Prototype Quick Fill */}
          <div className="mt-6 pt-5 border-t border-border/60">
            <p className="text-[11px] text-muted-foreground mb-3 text-center">
              {t('demoCredentialsNotice')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillCredentials('superadmin@petboss.com', 'SuperAdmin@PetBoss2026!')}
                className="px-3 py-2 rounded-lg bg-surface-elevated hover:bg-primary/20 border border-primary/30 text-[11px] text-foreground transition-all text-center"
              >
                👑 {t('superAdminBadge')}
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('admin@petboss.com', 'Admin@PetBoss2026!')}
                className="px-3 py-2 rounded-lg bg-surface-elevated hover:bg-primary/20 border border-border text-[11px] text-foreground transition-all text-center"
              >
                🩺 {t('adminBadge')}
              </button>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            ← {t('backToSite')}
          </Link>
        </div>
      </div>
    </div>
  )
}
