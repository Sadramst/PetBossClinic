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
        disallow: ['/admin', '/api/', '/account', '/cart', '/checkout'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
