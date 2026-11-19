import 'server-only'
import { db } from '@/lib/db'
import { getLoyaltyConfig } from '@/lib/club/config'
import { tierProgress } from '@/lib/club/tiers'
import { SPECIES_LABEL, dueStatus, daysUntil, faNum } from '@/lib/club/pet-math'
import { ABANDONED_CART_HOURS } from '@/lib/club/segments'
import type { CouponTemplate } from '@/lib/club/messaging/personalize'
import { tehranParts } from '@/lib/club/messaging/rules'

// ── 1. Next-best-offer insights (deterministic, computed from the customer's own data) ──────────

export type InsightAction =
  | { type: 'coupon'; body: string; couponTemplate: CouponTemplate; petId?: string }
  | { type: 'message'; body: string; petId?: string }
  | { type: 'task'; note: string }

export interface Insight {
  id: string
  title: string
  reason: string
  /** Higher = more valuable right now. Insights are returned sorted by it. */
  priority: number
  action: InsightAction
}

const DAY = 86_400_000

/** Suggestions an admin can act on with one click. Message bodies use the same {variables} as campaigns. */
export async function buildInsights(customerId: string, now = new Date()): Promise<Insight[]> {
  const c = await db.customer.findUnique({
    where: { id: customerId },
    include: {
      pets: { where: { isActive: true, deceasedAt: null }, include: { records: { where: { nextDueAt: { not: null } }, orderBy: { nextDueAt: 'asc' } } } },
      cartSnapshot: true,
    },
  })
  if (!c) return []
  const cfg = await getLoyaltyConfig()
  const out: Insight[] = []

  if (!c.marketingSmsConsent) {
    out.push({
      id: 'no-consent',
      title: 'این مشتری پیامک تبلیغاتی نمی‌خواهد',
      reason: 'رضایت دریافت پیامک ثبت نشده است؛ فقط می‌توانید هنگام مراجعه حضوری یا تماس از او اجازه بگیرید.',
      priority: 1,
      action: { type: 'task', note: 'هنگام مراجعه‌ی بعدی از مشتری برای دریافت پیامک‌های باشگاه اجازه بگیرید.' },
    })
  }

  // Food brand: a brand-limited coupon on the exact food the pet eats.
  for (const pet of c.pets) {
    if (!pet.foodBrand || !['DOG', 'CAT'].includes(pet.species)) continue
    const daysSince = c.lastOrderAt ? Math.floor((now.getTime() - c.lastOrderAt.getTime()) / DAY) : null
    out.push({
      id: `brand-${pet.id}`,
      title: `کد تخفیف غذای ${pet.foodBrand} برای ${pet.name}`,
      reason: `${pet.name} (${SPECIES_LABEL[pet.species]}) غذای «${pet.foodBrand}» می‌خورد${daysSince !== null ? ` و ${faNum(daysSince)} روز از آخرین خرید این مشتری می‌گذرد` : ''}. یک کد محدود به همان برند، خرید مجدد را آسان می‌کند.`,
      priority: 70 + (daysSince !== null && daysSince > 30 ? 10 : 0),
      action: {
        type: 'coupon',
        petId: pet.id,
        body: 'سلام {name} عزیز، برای غذای {petName} کد {code} را تا {expiry} روی برند مورد علاقه‌اش در پت‌باس دارید: {link}',
        couponTemplate: { type: 'PERCENT', value: 10, maxDiscount: 150_000, minSubtotal: 0, validDays: 14, restrictToPetBrand: true },
      },
    })
  }

  // Health: vaccines and checkups due soon or overdue.
  for (const pet of c.pets) {
    const due = pet.records.find((r) => r.nextDueAt && dueStatus(r.nextDueAt, now, 30) !== 'ok')
    if (!due?.nextDueAt) continue
    const days = daysUntil(due.nextDueAt, now)
    out.push({
      id: `vaccine-${due.id}`,
      title: `${due.title} ${pet.name} ${days < 0 ? 'عقب افتاده' : 'نزدیک است'}`,
      reason: days < 0 ? `موعد این مورد ${faNum(-days)} روز پیش گذشته است.` : `موعد آن ${faNum(days)} روز دیگر است.`,
      priority: days < 0 ? 95 : 85,
      action: { type: 'message', petId: pet.id, body: 'سلام {name} عزیز، موعد «{item}» برای {petName} نزدیک است. برای رزرو وقت با کلینیک پت‌باس تماس بگیرید.' },
    })
  }

  // Lapsed customer.
  if (c.ordersCount > 0 && c.lastOrderAt) {
    const idle = Math.floor((now.getTime() - c.lastOrderAt.getTime()) / DAY)
    if (idle >= 60) {
      out.push({
        id: 'winback',
        title: 'مشتری مدتی است خرید نکرده',
        reason: `${faNum(idle)} روز از آخرین خرید او گذشته است؛ زمان مناسبی برای یک پیشنهاد بازگشت.`,
        priority: 75,
        action: {
          type: 'coupon',
          body: '{name} عزیز، دلمان برایتان تنگ شده! کد {code} تا {expiry} روی خرید بعدی شما برای {petName}: {link}',
          couponTemplate: { type: 'PERCENT', value: 10, maxDiscount: 200_000, minSubtotal: 300_000, validDays: 10, restrictToPetBrand: false },
        },
      })
    }
  }

  // Abandoned cart.
  if (c.cartSnapshot && c.cartSnapshot.itemCount > 0 && now.getTime() - c.cartSnapshot.updatedAt.getTime() > ABANDONED_CART_HOURS * 3_600_000) {
    out.push({
      id: 'cart',
      title: 'سبد خرید رها شده',
      reason: `${faNum(c.cartSnapshot.itemCount)} قلم کالا در سبد او مانده است.`,
      priority: 80,
      action: { type: 'message', body: '{name} عزیز، سبد خرید شما در پت‌باس منتظر است. برای تکمیل خرید: {link}' },
    })
  }

  // Tier push: close to the next level.
  const prog = tierProgress(cfg.tiers, c.lifetimePoints)
  if (prog.next && prog.remaining > 0 && prog.percent >= 80) {
    out.push({
      id: 'tier-push',
      title: `نزدیک به سطح ${prog.next.label}`,
      reason: `فقط ${faNum(prog.remaining)} امتیاز تا سطح ${prog.next.label} باقی مانده است.`,
      priority: 60,
      action: { type: 'message', body: '{name} عزیز، فقط چند امتیاز تا ارتقا به سطح بعدی باشگاه پت‌باس فاصله دارید. موجودی فعلی: {points} امتیاز.' },
    })
  }

  // Birthday within two weeks.
  if (c.birthDate) {
    const t = tehranParts(now)
    const next = new Date(Date.UTC(t.year, c.birthDate.getUTCMonth(), c.birthDate.getUTCDate(), 12))
    if (next.getTime() < now.getTime() - DAY) next.setUTCFullYear(t.year + 1)
    const days = Math.ceil((next.getTime() - now.getTime()) / DAY)
    if (days >= 0 && days <= 14) {
      out.push({
        id: 'birthday',
        title: 'تولد مشتری نزدیک است',
        reason: days === 0 ? 'امروز تولد اوست.' : `${faNum(days)} روز تا تولدش مانده است.`,
        priority: 65,
        action: { type: 'message', body: '{name} عزیز، تولدتان مبارک! تیم پت‌باس برایتان روزی پر از شادی آرزو می‌کند.' },
      })
    }
  }

  // Profile gaps: cheap CRM tasks.
  if (c.pets.length === 0) {
    out.push({ id: 'no-pet', title: 'هنوز حیوانی ثبت نکرده', reason: 'بدون پروفایل حیوان نمی‌توان پیشنهاد شخصی داد.', priority: 40, action: { type: 'task', note: 'از مشتری بپرسید چه حیوانی دارد و پروفایلش را برایش بسازید.' } })
  } else {
    const bare = c.pets.find((p) => !p.photoUrl || !p.birthDate || !p.foodBrand)
    if (bare) {
      out.push({
        id: `profile-${bare.id}`,
        title: `پروفایل ${bare.name} ناقص است`,
        reason: 'تاریخ تولد، عکس یا برند غذا ثبت نشده؛ این اطلاعات برای تخفیف‌های شخصی لازم است.',
        priority: 30,
        action: { type: 'task', note: `اطلاعات ${bare.name} (تاریخ تولد، برند غذا، عکس) را کامل کنید.` },
      })
    }
  }

  return out.sort((a, b) => b.priority - a.priority)
}

// ── 2. Message drafting (Anthropic API with anonymised facts, deterministic fallback) ────────────

export const DRAFT_GOALS = ['winback', 'vaccine', 'birthday', 'repeatPurchase', 'abandonedCart', 'promo', 'tierUp', 'welcome'] as const
export type DraftGoal = (typeof DRAFT_GOALS)[number]
export const DRAFT_TONES = ['friendly', 'formal', 'playful'] as const
export type DraftTone = (typeof DRAFT_TONES)[number]

export const GOAL_LABEL: Record<DraftGoal, string> = {
  winback: 'بازگرداندن مشتری ساکت',
  vaccine: 'یادآوری واکسن یا معاینه',
  birthday: 'تبریک تولد',
  repeatPurchase: 'خرید مجدد غذا',
  abandonedCart: 'سبد خرید رها شده',
  promo: 'معرفی پیشنهاد ویژه',
  tierUp: 'ارتقای سطح باشگاه',
  welcome: 'خوش‌آمدگویی',
}

/** What the model may see: categories and numbers only. No names, phones, emails, addresses or free text. */
export interface DraftFacts {
  species?: string
  breed?: string
  foodBrand?: string
  daysSinceLastOrder?: number
  tier?: string
  discountPercent?: number
  hasCode?: boolean
}

export interface DraftRequest {
  goal: DraftGoal
  tone?: DraftTone
  facts?: DraftFacts
}

export interface DraftResult {
  options: string[]
  /** "ai" when the model wrote them, "fallback" for the built-in templates. */
  source: 'ai' | 'fallback'
}

const SMS_LIMIT = 300

function scrub(v: unknown, max = 40): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\S+@\S+/g, '')
    .replace(/[\d۰-۹٠-٩]{5,}/g, '')
    .replace(/[{}<>"\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
  return s || undefined
}

/** Whitelists and cleans the facts. Anything unexpected is dropped before it can reach the API. */
export function sanitizeFacts(f: DraftFacts | undefined): DraftFacts {
  const out: DraftFacts = {}
  if (!f) return out
  const species = scrub(f.species, 20)
  if (species) out.species = species
  const breed = scrub(f.breed)
  if (breed) out.breed = breed
  const food = scrub(f.foodBrand)
  if (food) out.foodBrand = food
  const tier = scrub(f.tier, 20)
  if (tier) out.tier = tier
  if (typeof f.daysSinceLastOrder === 'number' && Number.isFinite(f.daysSinceLastOrder)) out.daysSinceLastOrder = Math.min(3650, Math.max(0, Math.floor(f.daysSinceLastOrder)))
  if (typeof f.discountPercent === 'number' && Number.isFinite(f.discountPercent)) out.discountPercent = Math.min(100, Math.max(0, Math.floor(f.discountPercent)))
  if (f.hasCode === true) out.hasCode = true
  return out
}

const FALLBACKS: Record<DraftGoal, Record<DraftTone, string>> = {
  winback: {
    friendly: '{name} عزیز، دلمان برای شما و {petName} تنگ شده! یک سر به پت‌باس بزنید؛ کد {code} تا {expiry} منتظر شماست: {link}',
    formal: '{name} گرامی، مدتی است از شما در پت‌باس خبری نداریم. برای تقدیر از همراهی‌تان، کد تخفیف {code} تا {expiry} اعتبار دارد: {link}',
    playful: 'هی {name}! {petName} می‌گه خیلی وقته غذا و تشویقی‌اش تموم شده با کد {code} تا {expiry} برگرد: {link}',
  },
  vaccine: {
    friendly: 'سلام {name} عزیز، موعد «{item}» برای {petName} نزدیک است. برای رزرو وقت با کلینیک پت‌باس تماس بگیرید.',
    formal: '{name} گرامی، یادآوری می‌شود موعد «{item}» برای {petName} فرا می‌رسد. جهت هماهنگی با کلینیک پت‌باس تماس بگیرید.',
    playful: '{petName} یادآوری می‌کند: وقت «{item}» رسیده! یک وقت خوب در پت‌باس رزرو کنید تا سالم و سرحال بماند.',
  },
  birthday: {
    friendly: 'تولد {petName} مبارک! پت‌باس یک هدیه‌ی کوچک دارد: کد {code} تا {expiry} روی خرید بعدی شما.',
    formal: '{name} گرامی، تولد {petName} را تبریک می‌گوییم. به همین مناسبت کد هدیه‌ی {code} تا {expiry} در اختیار شماست.',
    playful: 'امروز یک مهمانی مخصوص برای {petName} داریم! با کد {code} تا {expiry} هدیه‌ات را بگیر: {link}',
  },
  repeatPurchase: {
    friendly: 'سلام {name} عزیز، {item} {petName} احتمالاً رو به اتمام است. برای سفارش دوباره: {link}',
    formal: '{name} گرامی، با توجه به زمان مصرف، موجودی {item} رو به پایان است. ثبت سفارش مجدد: {link}',
    playful: 'کاسه‌ی {petName} دارد خالی می‌شود! قبل از اینکه شکایت کند سفارش بدهید: {link}',
  },
  abandonedCart: {
    friendly: '{name} عزیز، «{item}» هنوز در سبد خرید شماست. برای تکمیل خرید: {link}',
    formal: '{name} گرامی، سبد خرید شما در پت‌باس تکمیل نشده است. برای ادامه‌ی خرید: {link}',
    playful: 'سبد خریدت دلتنگ شده {item} منتظر توست: {link}',
  },
  promo: {
    friendly: '{name} عزیز، یک پیشنهاد ویژه برای {petName} داریم: کد {code} تا {expiry} روی خرید شما. {link}',
    formal: '{name} گرامی، کد تخفیف اختصاصی شما {code} تا {expiry} معتبر است. {link}',
    playful: 'خبر خوب برای {petName}! با کد {code} تا {expiry} تخفیف بگیر: {link}',
  },
  tierUp: {
    friendly: '{name} عزیز، فقط چند امتیاز تا سطح بعدی باشگاه پت‌باس فاصله دارید. موجودی فعلی: {points} امتیاز.',
    formal: '{name} گرامی، امتیاز شما در باشگاه پت‌باس {points} است و به ارتقای سطح نزدیک هستید.',
    playful: 'یک قدم تا سطح بعدی باشگاه پت‌باس! الان {points} امتیاز داری، یک خرید دیگر کافی است.',
  },
  welcome: {
    friendly: 'سلام {name} عزیز، به باشگاه مشتریان پت‌باس خوش آمدید! از همین حالا با هر خرید و خدمت امتیاز می‌گیرید.',
    formal: '{name} گرامی، عضویت شما در باشگاه مشتریان پت‌باس را خوش‌آمد می‌گوییم. با هر خرید و خدمت امتیاز دریافت می‌کنید.',
    playful: 'به خانواده‌ی پت‌باس خوش آمدی! هر خرید و هر خدمت برایت امتیاز دارد.',
  },
}

const TONE_ORDER: Record<DraftTone, DraftTone[]> = {
  friendly: ['friendly', 'formal', 'playful'],
  formal: ['formal', 'friendly', 'playful'],
  playful: ['playful', 'friendly', 'formal'],
}

/** High-quality built-in options, used when no API key is set or the call fails. */
export function fallbackDrafts(goal: DraftGoal, tone: DraftTone = 'friendly'): string[] {
  const set = FALLBACKS[goal] ?? FALLBACKS.promo
  return TONE_ORDER[tone].map((t) => set[t])
}

const ALLOWED_VARS = ['{name}', '{petName}', '{petBreed}', '{points}', '{tier}', '{code}', '{expiry}', '{link}', '{item}']

function parseOptions(text: string): string[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  try {
    const arr = JSON.parse(text.slice(start, end + 1)) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter((s) => s.length >= 10 && Array.from(s).length <= SMS_LIMIT)
  } catch {
    return []
  }
}

/** Builds the request body sent to the Anthropic Messages API. Exported so tests can prove it carries no PII. */
export function buildAnthropicRequest(req: DraftRequest, model: string) {
  const facts = sanitizeFacts(req.facts)
  const tone = req.tone ?? 'friendly'
  const system =
    'You write short Persian (Farsi) SMS messages for a pet clinic and pet shop called Pet Boss (پت‌باس). ' +
    'Reply with ONLY a JSON array of exactly 3 strings, no other text. ' +
    `Each message is under ${SMS_LIMIT} characters, natural, warm, never pushy, with no hashtags. ` +
    `Use these placeholders where they fit, exactly as written: ${ALLOWED_VARS.join(' ')}. ` +
    'Never invent names, phone numbers, prices or discount amounts that are not in the facts. Do not add an unsubscribe line.'
  const user = JSON.stringify({ goal: req.goal, goalDescription: GOAL_LABEL[req.goal], tone, facts })
  return { model, max_tokens: 900, system, messages: [{ role: 'user', content: user }] }
}

export async function draftMessage(req: DraftRequest): Promise<DraftResult> {
  const goal = (DRAFT_GOALS as readonly string[]).includes(req.goal) ? req.goal : 'promo'
  const tone = (DRAFT_TONES as readonly string[]).includes(req.tone ?? '') ? (req.tone as DraftTone) : 'friendly'
  const fallback = fallbackDrafts(goal, tone)
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { options: fallback, source: 'fallback' }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(buildAnthropicRequest({ goal, tone, facts: req.facts }, process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5')),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return { options: fallback, source: 'fallback' }
    const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> }
    const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
    const parsed = parseOptions(text).slice(0, 3)
    if (parsed.length === 0) return { options: fallback, source: 'fallback' }
    // Top up from the built-in set so the admin always sees three choices.
    const options = [...parsed, ...fallback.filter((f) => !parsed.includes(f))].slice(0, 3)
    return { options, source: parsed.length >= 1 ? 'ai' : 'fallback' }
  } catch {
    return { options: fallback, source: 'fallback' }
  }
}

/** Anonymised facts for one customer, ready for draftMessage (species, breed, brand, recency, tier only). */
export async function factsForCustomer(customerId: string, now = new Date()): Promise<DraftFacts> {
  const c = await db.customer.findUnique({
    where: { id: customerId },
    select: { tier: true, lastOrderAt: true, pets: { where: { isActive: true, deceasedAt: null }, orderBy: { createdAt: 'asc' }, take: 1, select: { species: true, breed: true, foodBrand: true } } },
  })
  if (!c) return {}
  const pet = c.pets[0]
  return sanitizeFacts({
    species: pet ? SPECIES_LABEL[pet.species] : undefined,
    breed: pet?.breed ?? undefined,
    foodBrand: pet?.foodBrand ?? undefined,
    tier: c.tier,
    daysSinceLastOrder: c.lastOrderAt ? Math.floor((now.getTime() - c.lastOrderAt.getTime()) / DAY) : undefined,
  })
}
