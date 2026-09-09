import { MetadataRoute } from 'next';

const BASE_URL = 'https://www.petbossclinic.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // Static pages for both locales
  const staticPages = [
    { path: '', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/services', priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/shop', priority: 0.9, changeFrequency: 'daily' as const },
    { path: '/about', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/contact', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/faq', priority: 0.7, changeFrequency: 'weekly' as const },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const page of staticPages) {
    // Persian (default locale — no prefix)
    entries.push({
      url: `${BASE_URL}${page.path || '/'}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: {
        languages: {
          'fa-IR': `${BASE_URL}${page.path || '/'}`,
          en: `${BASE_URL}/en${page.path || '/'}`,
        },
      },
    });

    // English
    entries.push({
      url: `${BASE_URL}/en${page.path || '/'}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority * 0.9,
      alternates: {
        languages: {
          'fa-IR': `${BASE_URL}${page.path || '/'}`,
          en: `${BASE_URL}/en${page.path || '/'}`,
        },
      },
    });
  }

  return entries;
}