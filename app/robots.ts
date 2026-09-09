import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/', '/_next/'],
      },
    ],
    sitemap: 'https://www.petbossclinic.com/sitemap.xml',
    host: 'https://www.petbossclinic.com',
  };
}