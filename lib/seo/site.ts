/** Canonical origin of the public site. All canonical/OG/JSON-LD URLs derive from this. */
export const SITE_URL = 'https://www.petbossclinic.com';

/** Short brand used in titles (keeps them inside Google's ~60-character snippet). */
export const SITE_NAME_FA = 'پت‌باس';
/** Full brand used for Organization/siteName. */
export const SITE_NAME_LONG_FA = 'کلینیک دامپزشکی و پت‌شاپ پت‌باس';
export const SITE_NAME_EN = 'Pet Boss Clinic & Pet Shop';

export const SITE_HOME_TITLE = 'پت‌شاپ و کلینیک دامپزشکی پت‌باس در تهران | خرید لوازم سگ و گربه';
export const SITE_HOME_DESCRIPTION =
  'خرید آنلاین غذای سگ و گربه، تشویقی، دارو و لوازم حیوانات خانگی با ضمانت اصالت و تاریخ انقضای معتبر؛ کلینیک دامپزشکی و گرومینگ در قیطریه تهران.';

export const SITE_OG_IMAGE = '/images/petboss-sign.jpg';
export const SITE_LOGO = '/images/logo.png';

export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return p === '/' ? `${SITE_URL}/` : `${SITE_URL}${p}`;
}
