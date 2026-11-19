import 'server-only'
import type { MarketingConfig, Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export type MarketingConfigPatch = Partial<Omit<MarketingConfig, 'id' | 'updatedAt'>>

/** The single campaign settings row; created with defaults on first access. */
export async function getMarketingConfig(): Promise<MarketingConfig> {
  const found = await db.marketingConfig.findUnique({ where: { id: 'main' } })
  if (found) return found
  try {
    return await db.marketingConfig.create({ data: { id: 'main' } })
  } catch {
    // Another request created it first.
    return db.marketingConfig.findUniqueOrThrow({ where: { id: 'main' } })
  }
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number.isFinite(n) ? n : min)))

/** Saves settings after clamping numbers into sane ranges. Callers validate text. */
export async function updateMarketingConfig(patch: MarketingConfigPatch): Promise<MarketingConfig> {
  const data: Prisma.MarketingConfigUncheckedUpdateInput = { ...patch }
  if (patch.popupDelaySeconds !== undefined) data.popupDelaySeconds = clamp(patch.popupDelaySeconds, 0, 300)
  if (patch.welcomeValidDays !== undefined) data.welcomeValidDays = clamp(patch.welcomeValidDays, 1, 365)
  if (patch.welcomeMinSubtotal !== undefined) data.welcomeMinSubtotal = clamp(patch.welcomeMinSubtotal, 0, 1_000_000_000)
  if (patch.welcomeValue !== undefined) {
    const type = patch.welcomeType
    data.welcomeValue = type === 'PERCENT' ? clamp(patch.welcomeValue, 1, 100) : clamp(patch.welcomeValue, 0, 1_000_000_000)
  }
  await getMarketingConfig()
  return db.marketingConfig.update({ where: { id: 'main' }, data })
}
