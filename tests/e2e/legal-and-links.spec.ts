import { test, expect } from '@playwright/test'

// The welcome popup (8 s after load) would cover the page during long tests: these tests are not about it.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { localStorage.setItem('pb_welcome_popup_v1', String(Date.now() + 365 * 86400000)) } catch {}
  })
})


const LEGAL = [
  { path: '/shipping', h1: 'راهنمای خرید و ارسال' },
  { path: '/returns', h1: 'رویه بازگرداندن کالا' },
  { path: '/terms', h1: 'قوانین و مقررات' },
  { path: '/privacy', h1: 'حریم خصوصی' },
]

test.describe('shop policy pages', () => {
  for (const { path, h1 } of LEGAL) {
    test(`${path} is a real, indexable, canonical page`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(res?.status()).toBe(200)
      await expect(page.locator('h1')).toHaveText(h1)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.petbossclinic.com${path}`)
      // Indexable pages carry no robots tag at all, or one without "noindex".
      await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0)
      // Numbered sections with a working table of contents.
      const firstLink = page.locator('nav[aria-label="فهرست مطالب"] a').first()
      const target = (await firstLink.getAttribute('href'))!
      await expect(page.locator(target)).toHaveCount(1)
    })
  }

  test('shipping page shows the real configured fees, not placeholders', async ({ page }) => {
    await page.goto('/shipping', { waitUntil: 'domcontentloaded' })
    // The visible article text only (the raw HTML legitimately contains "undefined" in Next's own data).
    const text = await page.locator('article').innerText()
    expect(text).toMatch(/[۰-۹٬,]+ تومان/)
    expect(text).not.toMatch(/undefined|NaN|\[object/)
  })

  test('policy pages are in the sitemap', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    for (const { path } of LEGAL) expect(xml).toContain(`https://www.petbossclinic.com${path}</loc>`)
  })
})

test.describe('internal links', () => {
  test('every internal link on the main pages resolves (no dead links)', async ({ page, request }) => {
    test.setTimeout(180000)
    const start = ['/', '/shop', '/services', '/about', '/contact', '/faq', '/blog', '/account/login']
    const links = new Set<string>()
    for (const path of start) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      const hrefs = await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))
      for (const href of hrefs) {
        // Admin and machine endpoints are not part of the public link graph.
        if (href.startsWith('//') || href.startsWith('/admin') || href.startsWith('/api')) continue
        // Rows other specs create (and delete) while this one crawls are not part of the real site.
        if (/\/e2e-/.test(href) || decodeURIComponent(href).includes('کالای-فرم-')) continue
        links.add(href.split('#')[0] || '/')
      }
    }
    expect(links.size).toBeGreaterThan(20)

    const broken: string[] = []
    const queue = [...links]
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        for (let href = queue.pop(); href; href = queue.pop()) {
          const res = await request.get(href).catch(() => null)
          if (!res || res.status() >= 400) broken.push(`${href} → ${res?.status() ?? 'no response'}`)
        }
      })
    )
    expect(broken, `Dead links:\n${broken.join('\n')}`).toEqual([])
  })
})
