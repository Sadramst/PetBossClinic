'use server'

import { db } from '@/lib/db';
import { getSession, hasRoleAccess } from '@/lib/auth';
import { revalidatePath, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { ThemePreset } from '@/lib/theme/types';

const VALID_THEMES: readonly ThemePreset[] = [
  'petboss-luxury-dark',
  'petboss-luxury-light',
  'emerald-prestige',
  'royal-obsidian',
] as const;

export interface ThemeActionResponse {
  success?: boolean;
  error?: string;
  theme?: ThemePreset;
}

/**
 * Server action allowing clinic administrators to update the site-wide theme.
 * All public visitors and pages will immediately display this theme.
 */
export async function setGlobalThemeAction(themeId: ThemePreset): Promise<ThemeActionResponse> {
  const session = await getSession();
  if (!session || !hasRoleAccess(session.role, 'ADMIN')) {
    return { error: 'دسترسی غیرمجاز. فقط مدیران مجاز به تغییر پوسته سایت هستند.' };
  }

  if (!VALID_THEMES.includes(themeId)) {
    return { error: 'پوسته انتخاب شده نامعتبر است.' };
  }

  try {
    const existing = await db.siteSetting.findFirst();
    if (existing) {
      await db.siteSetting.update({
        where: { id: existing.id },
        data: {
          activeTheme: themeId,
          updatedById: session.userId,
        },
      });
    } else {
      await db.siteSetting.create({
        data: {
          nameFa: 'کلینیک تخصصی دامپزشکی و پت‌شاپ پت‌باس',
          activeTheme: themeId,
          updatedById: session.userId,
        },
      });
    }

    // Also synchronize the server-side cookie so the admin browser immediately matches
    try {
      const cookieStore = await cookies();
      cookieStore.set('petboss_theme', themeId, {
        path: '/',
        maxAge: 31536000,
        sameSite: 'lax',
      });
    } catch {
      // Best-effort cookie setting
    }

    // Invalidate theme caches and layout across all locales
    revalidateTag('clinic-theme');
    revalidateTag('site-settings');
    revalidatePath('/', 'layout');
    revalidatePath('/[locale]', 'layout');
    revalidatePath('/fa', 'layout');
    revalidatePath('/en', 'layout');

    return { success: true, theme: themeId };
  } catch (err: unknown) {
    console.error('Failed to set global clinic theme:', err);
    return { error: 'خطایی در ثبت پوسته در پایگاه داده رخ داد.' };
  }
}
