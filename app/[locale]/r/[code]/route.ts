import { NextResponse, type NextRequest } from 'next/server'
import { findReferrerByCode, normalizeReferralCode, REFERRAL_COOKIE } from '@/lib/club/referrals'

export const dynamic = 'force-dynamic'

/** Invite link: remembers the code for 30 days and sends the visitor to sign-up. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params
  const clean = normalizeReferralCode(code)
  const res = NextResponse.redirect(new URL('/account/login?mode=register', req.url))
  if (clean && (await findReferrerByCode(clean))) {
    res.cookies.set(REFERRAL_COOKIE, clean, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 86_400,
    })
  }
  return res
}
