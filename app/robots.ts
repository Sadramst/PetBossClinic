import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // Product images are served from /api/media and must stay crawlable for Google Images.
        // /_next/ is NOT blocked: Google needs our JS/CSS to render pages.
        allow: ['/', '/api/media/'],
        // /feeds/ is intentionally NOT listed: price-comparison sites (Torob, Emalls) fetch it and may honour
        // robots.txt. The feed responses carry X-Robots-Tag: noindex so they stay out of search results.
        disallow: ['/admin', '/api/', '/account', '/cart', '/checkout'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
