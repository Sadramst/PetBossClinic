/**
 * Creates Brand rows from lib/shop/brands.ts and links products whose name starts
 * with the brand (only products that have no brand yet). Idempotent.
 *
 *   npx tsx scripts/assign-brands.ts            # dry run
 *   npx tsx scripts/assign-brands.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { BRANDS, detectBrand } from '../lib/shop/brands'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

async function main() {
  const brandIds = new Map<string, string>()
  for (const [i, b] of BRANDS.entries()) {
    const existing = await prisma.brand.findUnique({ where: { slugFa: b.slug } })
    if (existing) {
      brandIds.set(b.slug, existing.id)
    } else if (APPLY) {
      const created = await prisma.brand.create({
        data: { slugFa: b.slug, nameFa: b.nameFa, nameEn: b.nameEn, sortOrder: i, isActive: true },
      })
      brandIds.set(b.slug, created.id)
    }
  }

  const products = await prisma.product.findMany({ where: { brandId: null }, select: { id: true, nameFa: true } })
  const counts = new Map<string, number>()
  for (const p of products) {
    const b = detectBrand(p.nameFa)
    if (!b) continue
    counts.set(b.slug, (counts.get(b.slug) ?? 0) + 1)
    if (APPLY) await prisma.product.update({ where: { id: p.id }, data: { brandId: brandIds.get(b.slug)! } })
  }

  const total = [...counts.values()].reduce((a, n) => a + n, 0)
  console.log([...counts].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}:${n}`).join('  '))
  console.log(`${APPLY ? 'Linked' : 'Would link'} ${total} of ${products.length} unbranded products.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
