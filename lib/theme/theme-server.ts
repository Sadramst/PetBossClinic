import { db } from '@/lib/db';
import { ThemePreset } from './types';

const VALID_THEMES: readonly ThemePreset[] = [
  'petboss-luxury-dark',
  'petboss-luxury-light',
  'emerald-prestige',
  'royal-obsidian',
] as const;

/**
 * Returns the authoritative active clinic theme from SiteSetting.
 * Reads directly from PostgreSQL to guarantee instant real-time synchronization
 * across all visitors, devices, and incognito sessions.
 */
export async function getActiveClinicTheme(): Promise<ThemePreset> {
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
