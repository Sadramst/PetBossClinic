/**
 * One-off data cleanup: converts Arabic Yeh/Kaf (ي ك) to Persian (ی ک) in product and
 * category names/descriptions, and rebuilds product slugs from the cleaned names.
 *
 * Safe to run before product pages are indexed (slugs change). Idempotent.
 *
 *   npx tsx scripts/normalize-persian-text.ts            # dry run, prints a summary
 *   npx tsx scripts/normalize-persian-text.ts --apply    # writes changes
 */
import { PrismaClient } from '@prisma/client'
import { normalizeFa, slugifyFa } from '../lib/text/persian'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, nameFa: true, shortDescFa: true, descriptionFa: true, slugFa: true, sortOrder: true },
  })
  const taken = new Set(products.map((p) => p.slugFa))
  let productChanges = 0

  for (const p of products) {
    const nameFa = normalizeFa(p.nameFa)
    const shortDescFa = normalizeFa(p.shortDescFa)
    const descriptionFa = normalizeFa(p.descriptionFa)

    // Rebuild the slug only when it differs after normalisation (keeps the numeric suffix unique).
    let slugFa = p.slugFa
    const cleanedSlug = slugifyFa(p.slugFa)
    if (cleanedSlug && cleanedSlug !== p.slugFa) {
      slugFa = cleanedSlug
      if (taken.has(slugFa)) slugFa = `${cleanedSlug}-${p.sortOrder}`
      taken.delete(p.slugFa)
      taken.add(slugFa)
    }

    const changed =
      nameFa !== p.nameFa || shortDescFa !== p.shortDescFa || descriptionFa !== p.descriptionFa || slugFa !== p.slugFa
    if (!changed) continue
    productChanges++
    if (productChanges <= 5) console.log(`  ${p.slugFa}  ->  ${slugFa}`)
    if (APPLY) {
      await prisma.product.update({ where: { id: p.id }, data: { nameFa, shortDescFa, descriptionFa, slugFa } })
    }
  }

  const categories = await prisma.productCategory.findMany({ select: { id: true, nameFa: true, descriptionFa: true } })
  let categoryChanges = 0
  for (const c of categories) {
    const nameFa = normalizeFa(c.nameFa)
    const descriptionFa = normalizeFa(c.descriptionFa)
    if (nameFa === c.nameFa && descriptionFa === c.descriptionFa) continue
    categoryChanges++
    if (APPLY) await prisma.productCategory.update({ where: { id: c.id }, data: { nameFa, descriptionFa } })
  }

  console.log(`${APPLY ? 'Updated' : 'Would update'} ${productChanges} products and ${categoryChanges} categories.`)
  if (!APPLY) console.log('Dry run only. Re-run with --apply to write changes.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
