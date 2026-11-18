'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Prisma, type PaymentMethod } from '@prisma/client'
import { db } from '@/lib/db'
import { getCustomer } from '@/lib/customer/session'
import { sanitizeCartInput } from '@/lib/shop/cart-types'
import { allocateOrderStock, nextOrderNumber, priceCart, releaseOrderStock, type PricedLine } from '@/lib/shop/orders'
import { codAllowed, shippingFor, SHIPPING } from '@/lib/shop/shipping'
import { requestPayment, startPayUrl, zarinpalConfigured } from '@/lib/payments/zarinpal'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { normalizeFa } from '@/lib/text/persian'

export interface CheckoutState {
  error?: string
  /** Lines with problems (out of stock, price changed...) so the cart can show them */
  lines?: PricedLine[]
  redirectTo?: string
  /** The session is gone: the UI should offer to sign in again. */
  needsLogin?: boolean
  ok?: boolean
}

const SESSION_EXPIRED = 'نشست شما به پایان رسیده است. دوباره وارد شوید.'

/**
 * priceCart silently skips product ids that no longer exist (hard-deleted products).
 * Add a placeholder line with a problem for each, so the cart and checkout can show
 * the customer which line blocks the order and let them remove it.
 */
function withMissingLines(items: { productId: string; quantity: number }[], lines: PricedLine[]): PricedLine[] {
  const known = new Set(lines.map((l) => l.productId))
  const missing = items
    .filter((i) => !known.has(i.productId))
    .map<PricedLine>((i) => ({
      productId: i.productId,
      nameFa: 'کالای حذف‌شده',
      slugFa: '',
      sku: null,
      image: '/images/categories/other.jpg',
      unitPrice: 0,
      quantity: i.quantity,
      lineTotal: 0,
      available: 0,
      problem: 'این کالا دیگر موجود نیست.',
    }))
  return missing.length ? [...lines, ...missing] : lines
}

/** Where a finished (or already existing) order sends the customer. */
function orderLanding(order: { number: string; paymentMethod: PaymentMethod }): string {
  return order.paymentMethod === 'COD' ? `/account/orders/${order.number}?placed=1` : `/account/orders/${order.number}`
}

/** Public origin of this deployment (works on previews too) for the payment callback. */
async function origin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'www.petbossclinic.com'
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

async function startOnlinePayment(order: { id: string; number: string; total: number }, mobile: string) {
  const amountRial = order.total * 10
  const res = await requestPayment({
    amountRial,
    callbackUrl: `${await origin()}/api/payment/zarinpal/callback`,
    description: `سفارش ${order.number} - پت‌شاپ پت‌باس`,
    mobile,
  })
  if (!res.ok) return { error: res.error }
  await db.payment.create({
    data: {
      orderId: order.id,
      provider: 'zarinpal',
      amountRial,
      authority: res.authority,
      raw: res.raw as Prisma.InputJsonValue,
    },
  })
  return { redirectTo: startPayUrl(res.authority) }
}

export async function placeOrderAction(input: {
  items: unknown
  addressId: string
  paymentMethod: PaymentMethod
  note?: string
  /** One random key per checkout visit: a double submit returns the first order instead of a second one. */
  idempotencyKey?: string
}): Promise<CheckoutState> {
  const customer = await getCustomer()
  if (!customer) return { error: SESSION_EXPIRED, needsLogin: true, redirectTo: '/account/login?next=/checkout' }

  const idempotencyKey =
    typeof input.idempotencyKey === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(input.idempotencyKey) ? input.idempotencyKey : null
  const findExisting = () =>
    idempotencyKey
      ? db.order.findFirst({
          where: { idempotencyKey, customerId: customer.id },
          select: { number: true, paymentMethod: true },
        })
      : Promise.resolve(null)
  // The same checkout was already submitted (double tap, retry after a slow response).
  const already = await findExisting()
  if (already) return { redirectTo: orderLanding(already) }

  if (!checkRateLimit(`checkout:${customer.id}`, 10, 600_000).allowed) {
    return { error: 'درخواست‌های زیادی ثبت شده است. چند دقیقه دیگر تلاش کنید.' }
  }

  const items = sanitizeCartInput(input.items)
  if (items.length === 0) return { error: 'سبد خرید خالی است.' }

  const address = await db.address.findFirst({ where: { id: input.addressId, customerId: customer.id, deletedAt: null } })
  if (!address) return { error: 'نشانی ارسال را انتخاب کنید.' }

  const method: PaymentMethod = input.paymentMethod === 'COD' ? 'COD' : 'ONLINE'
  if (method === 'COD' && !codAllowed(address.province)) {
    return { error: 'پرداخت در محل فقط برای سفارش‌های تهران امکان‌پذیر است.' }
  }
  if (method === 'ONLINE' && !zarinpalConfigured()) {
    return { error: 'پرداخت آنلاین به‌زودی فعال می‌شود. فعلاً «پرداخت در محل» را انتخاب کنید یا با کلینیک تماس بگیرید.' }
  }

  const priced = await priceCart(items)
  if (priced.hasProblems || priced.lines.length !== items.length) {
    return { error: 'برخی اقلام سبد تغییر کرده‌اند. لطفاً سبد را بررسی کنید.', lines: withMissingLines(items, priced.lines) }
  }

  const { fee } = shippingFor(address.province, priced.subtotal)
  const total = priced.subtotal + fee
  const fullAddress = [address.addressLine, address.plaque && `پلاک ${address.plaque}`, address.unit && `واحد ${address.unit}`]
    .filter(Boolean)
    .join('، ')

  let order: { id: string; number: string; total: number } | null = null
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    try {
      order = await db.$transaction(async (tx) =>
        tx.order.create({
          data: {
            number: await nextOrderNumber(tx),
            customerId: customer.id,
            status: method === 'COD' ? 'CONFIRMED' : 'PENDING_PAYMENT',
            paymentMethod: method,
            subtotal: priced.subtotal,
            shippingFee: fee,
            total,
            shipName: address.recipientName,
            shipPhone: address.recipientPhone,
            shipProvince: address.province,
            shipCity: address.city,
            shipAddress: fullAddress,
            shipPostal: address.postalCode,
            customerNote: normalizeFa(input.note ?? '').slice(0, 500) || null,
            idempotencyKey,
            items: {
              create: priced.lines.map((l) => ({
                productId: l.productId,
                nameFa: l.nameFa,
                sku: l.sku,
                slugFa: l.slugFa,
                unitPrice: l.unitPrice,
                quantity: l.quantity,
                lineTotal: l.lineTotal,
              })),
            },
          },
          select: { id: true, number: true, total: true },
        })
      )
    } catch (err) {
      // Two orders raced for the same number: retry with the next one.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // ...unless it was the same checkout submitted twice: hand back the first order.
        const twin = await findExisting()
        if (twin) return { redirectTo: orderLanding(twin) }
        continue
      }
      throw err
    }
  }
  if (!order) return { error: 'ثبت سفارش با خطا مواجه شد. دوباره تلاش کنید.' }

  if (method === 'COD') {
    await allocateOrderStock(order.id)
    return { redirectTo: `/account/orders/${order.number}?placed=1` }
  }
  const pay = await startOnlinePayment(order, customer.phone)
  return 'error' in pay ? { error: pay.error, redirectTo: `/account/orders/${order.number}` } : pay
}

/** Pay again for an unpaid online order (e.g. the customer closed the bank page). */
export async function retryPaymentAction(orderNumber: string): Promise<CheckoutState> {
  const customer = await getCustomer()
  if (!customer) return { error: SESSION_EXPIRED, needsLogin: true }
  if (!checkRateLimit(`pay-retry:${customer.id}`, 10, 600_000).allowed) {
    return { error: 'درخواست‌های زیادی ثبت شده است. چند دقیقه دیگر تلاش کنید.' }
  }
  if (!zarinpalConfigured()) return { error: 'پرداخت آنلاین در حال حاضر در دسترس نیست. با کلینیک تماس بگیرید.' }
  const order = await db.order.findFirst({
    where: { number: orderNumber, customerId: customer.id, paymentMethod: 'ONLINE', status: { in: ['PENDING_PAYMENT', 'PAYMENT_FAILED'] } },
    include: { items: { select: { productId: true, quantity: true } } },
  })
  if (!order) return { error: 'سفارش قابل پرداخت پیدا نشد.' }

  // Stock may have run out since the order was created.
  const priced = await priceCart(order.items.filter((i) => i.productId).map((i) => ({ productId: i.productId!, quantity: i.quantity })))
  if (priced.hasProblems) return { error: 'برخی اقلام این سفارش دیگر موجود نیستند. لطفاً سفارش جدید ثبت کنید.' }

  const pay = await startOnlinePayment(order, customer.phone)
  return 'error' in pay ? { error: pay.error } : pay
}

/**
 * Lets the customer cancel their own order while nothing has been paid or packed:
 * an unpaid online order, or a cash-on-delivery order that is still only confirmed.
 * Reserved stock goes back on the shelf.
 */
export async function cancelOrderAction(orderNumber: string): Promise<CheckoutState> {
  const customer = await getCustomer()
  if (!customer) return { error: SESSION_EXPIRED, needsLogin: true }
  if (!checkRateLimit(`order-cancel:${customer.id}`, 10, 600_000).allowed) {
    return { error: 'درخواست‌های زیادی ثبت شده است. چند دقیقه دیگر تلاش کنید.' }
  }
  const number = String(orderNumber ?? '').slice(0, 40)
  const order = await db.order.findFirst({ where: { number, customerId: customer.id }, select: { id: true } })
  if (!order) return { error: 'سفارش پیدا نشد.' }

  // Conditional update: the status is re-checked in the same statement, so an order
  // that was paid or moved on a moment ago is never cancelled by a stale page.
  const res = await db.order.updateMany({
    where: {
      id: order.id,
      paidAt: null,
      OR: [
        { status: { in: ['PENDING_PAYMENT', 'PAYMENT_FAILED'] } },
        { status: 'CONFIRMED', paymentMethod: 'COD' },
      ],
    },
    data: { status: 'CANCELLED' },
  })
  if (res.count !== 1) {
    return { error: 'این سفارش دیگر از طریق سایت قابل لغو نیست. برای لغو با کلینیک تماس بگیرید.' }
  }
  await releaseOrderStock(order.id)
  revalidatePath('/admin/orders')
  return { ok: true }
}

export interface Quote {
  lines: PricedLine[]
  subtotal: number
  shippingFee: number | null
  shippingMethod: string | null
  total: number
  codAllowed: boolean
  onlineAvailable: boolean
  freeShippingOver: number
}

/** Authoritative prices for the cart page and checkout summary (works for guests). */
export async function quoteAction(rawItems: unknown, province?: string): Promise<Quote> {
  const items = sanitizeCartInput(rawItems)
  const priced = await priceCart(items)
  const ship = province ? shippingFor(province, priced.subtotal) : null
  return {
    lines: withMissingLines(items, priced.lines),
    subtotal: priced.subtotal,
    shippingFee: ship ? ship.fee : null,
    shippingMethod: ship ? ship.method : null,
    total: priced.subtotal + (ship?.fee ?? 0),
    codAllowed: province ? codAllowed(province) : false,
    onlineAvailable: zarinpalConfigured(),
    freeShippingOver: SHIPPING.freeOver,
  }
}
