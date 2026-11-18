import { db } from '@/lib/db'
import type { LoyaltyConfig } from '@prisma/client'
import { DEFAULT_TIERS, parseTiers, type TierDef } from '@/lib/club/tiers'

export interface ClubConfig extends Omit<LoyaltyConfig, 'tiersJson'> {
  tiers: TierDef[]
}

/** Loads the singleton config, creating it with defaults on first use. */
export async function getLoyaltyConfig(client: Pick<typeof db, 'loyaltyConfig'> = db): Promise<ClubConfig> {
  let row = await client.loyaltyConfig.findUnique({ where: { id: 'main' } })
  if (!row) {
    try {
      row = await client.loyaltyConfig.create({ data: { id: 'main', tiersJson: DEFAULT_TIERS as never } })
    } catch {
      row = await client.loyaltyConfig.findUnique({ where: { id: 'main' } })
    }
  }
  if (!row) throw new Error('loyalty config unavailable')
  const { tiersJson, ...rest } = row
  return { ...rest, tiers: parseTiers(tiersJson) }
}

export type LoyaltyConfigPatch = Partial<
  Pick<
    LoyaltyConfig,
    | 'enabled' | 'pointsPerThousandToman' | 'serviceMultiplier' | 'signupBonus' | 'firstPetBonus' | 'petProfileBonus'
    | 'reviewBonus' | 'birthdayBonus' | 'referralGiven' | 'referralJoined' | 'pointValueToman' | 'pointsExpireMonths'
  >
> & { tiers?: TierDef[] }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))

/** Saves settings after clamping numbers into sane ranges (tiers must be validated by the caller). */
export async function updateLoyaltyConfig(patch: LoyaltyConfigPatch): Promise<ClubConfig> {
  await getLoyaltyConfig()
  const data: Record<string, unknown> = {}
  if (patch.enabled !== undefined) data.enabled = !!patch.enabled
  const ints: Array<[keyof LoyaltyConfigPatch, number, number]> = [
    ['pointsPerThousandToman', 0, 1000], ['signupBonus', 0, 100000], ['firstPetBonus', 0, 100000], ['petProfileBonus', 0, 100000],
    ['reviewBonus', 0, 100000], ['birthdayBonus', 0, 100000], ['referralGiven', 0, 100000], ['referralJoined', 0, 100000],
    ['pointValueToman', 0, 1_000_000],
  ]
  for (const [k, lo, hi] of ints) {
    const v = patch[k]
    if (typeof v === 'number' && Number.isFinite(v)) data[k] = clamp(v, lo, hi)
  }
  if (typeof patch.serviceMultiplier === 'number' && Number.isFinite(patch.serviceMultiplier)) {
    data.serviceMultiplier = Math.min(10, Math.max(0, Math.round(patch.serviceMultiplier * 100) / 100))
  }
  if (patch.pointsExpireMonths !== undefined) data.pointsExpireMonths = patch.pointsExpireMonths === null ? null : clamp(patch.pointsExpireMonths, 1, 120)
  if (patch.tiers) data.tiersJson = parseTiers(patch.tiers)
  await db.loyaltyConfig.update({ where: { id: 'main' }, data })
  return getLoyaltyConfig()
}
