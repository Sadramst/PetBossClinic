/**
 * Persian text normalisation. Inventory exports often contain Arabic Yeh (U+064A)
 * and Kaf (U+0643), while Iranian users type Persian Yeh (U+06CC) and Keheh (U+06A9).
 * Search engines and our own search treat them as different letters, so every
 * stored name, slug and search query is normalised to the Persian forms.
 */
const MAP: Record<string, string> = {
  'ي': 'ی', // Arabic Yeh -> Persian Yeh
  'ى': 'ی', // Alef Maksura -> Persian Yeh
  'ك': 'ک', // Arabic Kaf -> Persian Keheh
  'ة': 'ه', // Teh Marbuta -> Heh
};

const PATTERN = /[يىكة]/g;

export function normalizeFa(input: string): string;
export function normalizeFa(input: string | null | undefined): string | null | undefined;
export function normalizeFa(input: string | null | undefined) {
  if (input == null) return input;
  return input
    .replace(PATTERN, (ch) => MAP[ch] ?? ch)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** URL slug from a Persian/English name: keeps Persian letters, digits and latin words. */
export function slugifyFa(input: string): string {
  return normalizeFa(input)
    .toLowerCase()
    .replace(/‌/g, '-') // ZWNJ (half-space) -> hyphen
    .replace(/[^؀-ۿ\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
