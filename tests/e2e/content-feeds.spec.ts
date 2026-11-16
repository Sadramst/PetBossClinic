import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test.describe('blog, feeds and launch fallbacks', () => {
  test.skip(!process.env.DATABASE_URL, 'needs the local database')
  test.afterAll(() => prisma.$disconnect())

  test('published article renders with Article schema; drafts stay hidden', async ({ page, request }) => {
    const category = await prisma.postCategory.upsert({
      where: { slugFa: 'e2e-test' },
      update: {},
      create: { slugFa: 'e2e-test', nameFa: 'آزمون' },
    })
    const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`
    const slug = `e2e-article-${run}`
    const draftSlug = `${slug}-draft`
    const title = `مقاله آزمون خودکار ${run}`
    const draftTitle = `پیش‌نویس آزمون ${run}`
    const content = `## بخش آزمون\n${'این یک متن آزمایشی برای بررسی صفحه مقاله است. '.repeat(20)}\n- مورد اول\n- مورد دوم`
    await prisma.post.createMany({
      data: [
        { slugFa: slug, titleFa: title, contentFa: content, categoryId: category.id, publishedAt: new Date(Date.now() - 60000) },
        { slugFa: draftSlug, titleFa: draftTitle, contentFa: content, categoryId: category.id, publishedAt: null },
      ],
    })
    try {
      await page.goto(`/blog/${slug}`)
      await expect(page.locator('h1')).toHaveText(title)
      await expect(page.locator('h2#section-1')).toHaveText('بخش آزمون')
      const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((s) => JSON.parse(s))
      expect(schemas.find((s) => s['@type'] === 'Article')?.headline).toBe(title)

      await page.goto('/blog')
      await expect(page.locator('article h3', { hasText: title })).toBeVisible()
      await expect(page.getByText(draftTitle)).toHaveCount(0)

      expect((await request.get(`/blog/${draftSlug}`)).status()).toBe(404)
      // RSS is cached for an hour, so only check it is a valid feed here.
      const rss = await (await request.get('/feed.xml')).text()
      expect(rss).toContain('<rss version="2.0">')
    } finally {
      await prisma.post.deleteMany({ where: { slugFa: { in: [slug, draftSlug] } } })
    }
  })

  test('Torob feed returns the v3 shape for GET and POST', async ({ request }) => {
    const res = await request.get('/feeds/torob?page=1')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.api_version).toBe('torob_api_v3')
    expect(body.total).toBeGreaterThan(0)
    expect(body.products.length).toBeGreaterThan(0)
    const p = body.products[0]
    expect(p.page_url).toMatch(/^https:\/\/www\.petbossclinic\.com\/product\//)
    expect(['instock', 'outofstock']).toContain(p.availability)
    expect(typeof p.current_price).toBe('number')

    const one = await (await request.post('/feeds/torob', { data: { page_urls: [p.page_url] } })).json()
    expect(one.products).toHaveLength(1)
    expect(one.products[0].page_unique).toBe(p.page_unique)
  })

  test('Google-style product XML feed is well formed', async ({ request }) => {
    const res = await request.get('/feeds/products.xml')
    expect(res.headers()['content-type']).toContain('xml')
    const xml = await res.text()
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"')
    expect(xml).toMatch(/<g:price>\d+ IRR<\/g:price>/)
    expect((xml.match(/<item>/g) ?? []).length).toBeGreaterThan(100)
  })
})
