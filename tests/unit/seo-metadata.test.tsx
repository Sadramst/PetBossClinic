import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  clampText,
  clampDescription,
  productSeoTitle,
  categorySeoTitle,
  pageMetadata,
  MAX_DESCRIPTION,
  MAX_TITLE,
} from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/site';
import { ProductJsonLd, WebSiteJsonLd, safeJsonLd } from '@/lib/seo/json-ld';

describe('canonical URLs', () => {
  it('uses one canonical origin with a trailing slash only for the root', () => {
    expect(absoluteUrl('/')).toBe('https://www.petbossclinic.com/');
    expect(absoluteUrl('/shop')).toBe('https://www.petbossclinic.com/shop');
    expect(absoluteUrl('shop')).toBe('https://www.petbossclinic.com/shop');
    expect(absoluteUrl('https://example.com/x')).toBe('https://example.com/x');
  });
});

describe('text clamping', () => {
  const long = 'خرید غذای خشک گربه بالغ از برند رویال کنین با ضمانت اصالت کالا و تاریخ انقضای معتبر و ارسال سریع به تمام نقاط تهران '.repeat(2);

  it('leaves short text untouched', () => {
    expect(clampText('کوتاه', 160)).toBe('کوتاه');
  });

  it('never exceeds the limit and marks truncation', () => {
    const out = clampDescription(long);
    expect(out.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
    expect(out.endsWith('…')).toBe(true);
  });

  it('cuts on a word boundary rather than mid-word', () => {
    const out = clampText(long, 60);
    expect(out.length).toBeLessThanOrEqual(60);
    // The character before the ellipsis must not be a space.
    expect(out.slice(-2, -1)).not.toBe(' ');
  });
});

describe('titles', () => {
  it('keeps product titles inside the snippet limit and always keeps the brand', () => {
    const title = productSeoTitle('خمیر مالت تریکسی ۱۰۰ گرم برای گربه‌های بالغ');
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE);
    expect(title).toContain('پت‌باس');
    expect(title).toContain('خرید');
  });

  it('truncates a very long product name instead of the brand suffix', () => {
    const title = productSeoTitle('محصول '.repeat(30));
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE);
    expect(title.endsWith('پت‌باس')).toBe(true);
  });

  it('builds category titles with the primary keyword', () => {
    const title = categorySeoTitle('غذای خشک گربه');
    expect(title).toContain('غذای خشک گربه');
    expect(title).toContain('قیمت');
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE);
  });
});

describe('pageMetadata', () => {
  it('sets an absolute canonical, absolute title, OG and Twitter data', () => {
    const meta = pageMetadata({
      title: 'خدمات دامپزشکی پت‌باس | واکسیناسیون، جراحی و گرومینگ',
      description: 'توضیح کوتاه درباره خدمات دامپزشکی پت‌باس در قیطریه تهران.',
      path: '/services',
      image: '/images/veterinarian.jpg',
    });

    expect(meta.title).toEqual({ absolute: 'خدمات دامپزشکی پت‌باس | واکسیناسیون، جراحی و گرومینگ' });
    expect(meta.alternates?.canonical).toBe('https://www.petbossclinic.com/services');
    expect(meta.robots).toBeUndefined();
    const og = meta.openGraph as { url?: string; images?: Array<{ url: string }>; locale?: string };
    expect(og.url).toBe('https://www.petbossclinic.com/services');
    expect(og.locale).toBe('fa_IR');
    expect(og.images?.[0].url).toBe('https://www.petbossclinic.com/images/veterinarian.jpg');
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  it('marks filtered/private views noindex and keeps canonical absolute', () => {
    const meta = pageMetadata({
      title: 'نتایج جستجو',
      description: 'نتیجه',
      path: '/shop?q=cat',
      noindex: true,
      follow: true,
    });
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates?.canonical).toBe('https://www.petbossclinic.com/shop?q=cat');
  });

  it('clamps an over-long description before it reaches the document head', () => {
    const meta = pageMetadata({
      title: 'تست',
      description: 'توضیح '.repeat(80),
      path: '/',
    });
    expect((meta.description as string).length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it('honours a custom canonical override and ignores data-URL images', () => {
    const meta = pageMetadata({
      title: 'محصول',
      description: 'توضیح',
      path: '/product/x',
      canonical: 'https://www.petbossclinic.com/product/y',
      image: 'data:image/png;base64,AAAA',
    });
    expect(meta.alternates?.canonical).toBe('https://www.petbossclinic.com/product/y');
    const og = meta.openGraph as { images?: Array<{ url: string }> };
    expect(og.images?.[0].url).toBe('https://www.petbossclinic.com/images/petboss-sign.jpg');
  });
});

describe('JSON-LD', () => {
  it('escapes HTML so a product name cannot break out of the script tag', () => {
    const json = safeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('</script>');
    expect(json).toContain('\\u003c');
  });

  it('emits a WebSite node with a search action for sitelinks searchbox', () => {
    const html = renderToStaticMarkup(<WebSiteJsonLd />);
    const json = JSON.parse(html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
    expect(json['@type']).toBe('WebSite');
    expect(json.inLanguage).toBe('fa-IR');
    expect(json.potentialAction['@type']).toBe('SearchAction');
    expect(json.potentialAction.target.urlTemplate).toContain('/shop?q={search_term_string}');
  });

  it('never publishes a zero price but still reports availability', () => {
    const html = renderToStaticMarkup(
      <ProductJsonLd
        product={{
          name: 'محصول آزمایشی',
          description: 'توضیح',
          url: 'https://www.petbossclinic.com/product/test',
          images: ['https://www.petbossclinic.com/images/logo.png'],
          price: 0,
          stockStatus: 'OUT_OF_STOCK',
        }}
      />
    );
    const json = JSON.parse(html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
    expect(json.offers.price).toBeUndefined();
    expect(json.offers.priceCurrency).toBe('IRR');
    expect(json.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('converts Toman prices to IRR for Google', () => {
    const html = renderToStaticMarkup(
      <ProductJsonLd
        product={{
          name: 'محصول آزمایشی',
          description: 'توضیح',
          url: 'https://www.petbossclinic.com/product/test',
          images: [],
          price: 125000,
          stockStatus: 'IN_STOCK',
        }}
      />
    );
    const json = JSON.parse(html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
    expect(json.offers.price).toBe(1250000);
    expect(json.offers.availability).toBe('https://schema.org/InStock');
  });
});
