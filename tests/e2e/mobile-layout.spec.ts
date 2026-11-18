import { test, expect, type Page } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

/**
 * Phone-width layout guard. A page wider than the screen (even by a few pixels) makes
 * mobile browsers zoom out or allow sideways dragging, and shifts fixed bars such as the
 * header and bottom navigation. This once happened on the account pages, where a
 * non-wrapping menu stretched a one-column grid to 391px on a 360px screen.
 */
test.use({ viewport: { width: 360, height: 740 } })

const prisma = new PrismaClient()
const PUBLIC_PAGES = ['/', '/shop', '/shop/cat-dry-food', '/brand/royal-canin', '/blog', '/services', '/about', '/contact', '/faq', '/cart', '/account/login', '/account/login?mode=register', '/shipping', '/returns', '/terms', '/privacy']

function customerToken(customerId: string, version: number): string {
  const secret = process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const key = crypto.createHmac('sha256', secret).update('customer-session-v1').digest('hex')
  const body = Buffer.from(JSON.stringify({ cid: customerId, exp: Math.floor(Date.now() / 1000) + 3600, v: version })).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', key).update(body).digest('base64url')}`
}

/** Waits until the page has loaded and its fonts are in (text width depends on them). */
async function settle(page: Page) {
  await page.waitForLoadState('load')
  await page.evaluate(() => document.fonts.ready)
}

async function overflowOf(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const culprits: string[] = []
    for (const el of document.querySelectorAll('body, body *')) {
      const b = el.getBoundingClientRect()
      if (b.width > vw + 1) culprits.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 4).join('.')} (${Math.round(b.width)}px)`)
    }
    return { vw, scrollWidth: document.documentElement.scrollWidth, culprits: culprits.slice(0, 5) }
  })
}

test.describe('no horizontal overflow at 360px', () => {
  for (const path of PUBLIC_PAGES) {
    test(`public page ${path}`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await settle(page)
      const o = await overflowOf(page)
      expect(o.scrollWidth, `${path} is ${o.scrollWidth}px wide on a ${o.vw}px screen: ${o.culprits.join(', ')}`).toBeLessThanOrEqual(o.vw)
    })
  }

  test('product page', async ({ page }) => {
    const product = await prisma.product.findFirstOrThrow({ where: { isActive: true, deletedAt: null, price: { gt: 0 } }, select: { slugFa: true } })
    await page.goto(`/product/${encodeURIComponent(product.slugFa)}`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const o = await overflowOf(page)
    expect(o.scrollWidth, `product page overflows: ${o.culprits.join(', ')}`).toBeLessThanOrEqual(o.vw)
  })

  test.describe('signed-in customer', () => {
    test.skip(!process.env.DATABASE_URL, 'needs the local database')
    let customerId = ''
    test.afterAll(async () => {
      if (customerId) await prisma.customer.delete({ where: { id: customerId } }).catch(() => {})
      await prisma.$disconnect()
    })

    test('account pages, cart with items and checkout', async ({ page, context, baseURL }) => {
      const phone = `0937${String(Date.now()).slice(-7)}`
      const customer = await prisma.customer.create({ data: { phone, firstName: 'آزمون', lastName: 'موبایل', phoneVerifiedAt: new Date() } })
      customerId = customer.id
      await context.addCookies([{ name: 'pb_customer', value: customerToken(customer.id, customer.sessionVersion), url: baseURL! }])
      await prisma.address.create({
        data: {
          customerId, recipientName: 'آزمون موبایل', recipientPhone: phone, province: 'تهران', city: 'تهران',
          addressLine: 'خیابان شریعتی، کوچه آزمایشی، نبش میدان بسیار طولانی برای بررسی شکستن خط', postalCode: '1938973111', isDefault: true,
        },
      })
      const product = await prisma.product.findFirstOrThrow({
        where: { isActive: true, deletedAt: null, price: { gt: 0 }, stockStatus: 'IN_STOCK', inventory: { none: {} } },
        select: { id: true, nameFa: true, slugFa: true, price: true },
      })
      await context.addInitScript((line) => {
        try {
          localStorage.setItem('pb_cart_v1', JSON.stringify([line]))
        } catch {
          /* storage blocked */
        }
      }, { productId: product.id, name: product.nameFa, slug: product.slugFa, price: product.price, image: '/images/categories/other.jpg', quantity: 2 })

      for (const path of ['/account', '/account/profile', '/account/addresses', '/cart', '/checkout']) {
        await page.goto(path, { waitUntil: 'domcontentloaded' })
        await settle(page)
        const o = await overflowOf(page)
        expect(o.scrollWidth, `${path} is ${o.scrollWidth}px wide on a ${o.vw}px screen: ${o.culprits.join(', ')}`).toBeLessThanOrEqual(o.vw)
      }
    })
  })
})
