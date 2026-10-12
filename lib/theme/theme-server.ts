import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { ThemePreset } from './types';

const VALID_THEMES: readonly ThemePreset[] = [
  'petboss-luxury-dark',
  'petboss-luxury-light',
  'emerald-prestige',
  'royal-obsidian',
] as const;

async function fetchActiveClinicThemeFromDb(): Promise<ThemePreset> {
  try {
    const setting = await db.siteSetting.findFirst({
      select: { activeTheme: true },
    });
    const theme = setting?.activeTheme as ThemePreset | undefined;
    if (theme && VALID_THEMES.includes(theme)) {
      return theme;
    }
  } catch (err) {
    console.error('Failed to query active clinic theme, falling back to default:', err);
  }
  return 'petboss-luxury-dark';
}

/**
 * Returns the authoritative active clinic theme from SiteSetting.
 * Cached with tags ['clinic-theme', 'site-settings'] and invalidated
 * instantaneously on admin change without requiring force-dynamic.
 */
export const getActiveClinicTheme = unstable_cache(
  fetchActiveClinicThemeFromDb,
  ['clinic-active-theme-cache'],
  {
    revalidate: 3600,
    tags: ['clinic-theme', 'site-settings'],
  }
);
