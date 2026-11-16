import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'کلینیک دامپزشکی و پت‌شاپ پت‌باس',
    short_name: 'پت‌باس',
    description: 'کلینیک تخصصی دامپزشکی، جراحی، گرومینگ و پت‌شاپ لوکس سگ و گربه در قیطریه تهران',
    lang: 'fa-IR',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#181a20',
    theme_color: '#c5a059',
    categories: ['pets', 'shopping', 'health'],
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    shortcuts: [
      { name: 'پت‌شاپ', short_name: 'پت‌شاپ', url: '/shop' },
      { name: 'خدمات کلینیک', short_name: 'خدمات', url: '/services' },
      { name: 'تماس و نوبت', short_name: 'تماس', url: '/contact' },
    ],
  };
}
