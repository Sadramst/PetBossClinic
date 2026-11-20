import { db } from '@/lib/db'
import { normalizeMobile } from '@/lib/text/iran'
import { normalizeFa } from '@/lib/text/persian'
import { canonicalEmail } from '@/lib/customer/email'
import { newId, type DbClient } from '@/lib/crm/types'

export type ContactInput = { phone?: string | null; email?: string | null; name?: string | null }

/** Canonical mobile (09xxxxxxxxx) or null. Landlines and junk resolve to null: they never identify a person. */
export function normalizeContactPhone(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null
  return normalizeMobile(raw)
}

function cleanName(name?: string | null): string | null {
  if (!name) return null
  const n = normalizeFa(name).trim().slice(0, 80)
  return n || null
}

async function followMerged(client: DbClient, id: string) {
  let cur = await client.contact.findUnique({ where: { id } })
  for (let i = 0; cur?.mergedIntoId && i < 6; i++) {
    cur = await client.contact.findUnique({ where: { id: cur.mergedIntoId } })
  }
  return cur
}

/**
 * Finds or creates the single Contact for a person. Phone is the identity; email only links a record
 * to an existing contact (it never merges two different phones). Safe to call in parallel: inserts use
 * ON CONFLICT DO NOTHING so a lost race simply re-reads the winner, also inside a transaction.
 */
export async function resolveContact(input: ContactInput, tx?: DbClient): Promise<{ id: string; created: boolean } | null> {
  const client: DbClient = tx ?? db
  const phone = normalizeContactPhone(input.phone)
  const emailRaw = input.email?.trim()
  const email = emailRaw ? canonicalEmail(emailRaw) : null
  const name = cleanName(input.name)
  if (!phone && !email) return null

  let created = false
  let contact = null as Awaited<ReturnType<typeof followMerged>>

  if (phone) {
    const existing = await client.contact.findUnique({ where: { phone }, select: { id: true } })
    contact = existing ? await followMerged(client, existing.id) : null
    if (!contact) {
      const inserted = await client.$executeRaw`
        INSERT INTO "Contact" ("id", "phone", "name", "stage", "createdAt", "updatedAt")
        VALUES (${newId()}, ${phone}, ${name}, 'LEAD'::"LifecycleStage", NOW(), NOW())
        ON CONFLICT ("phone") DO NOTHING`
      created = inserted === 1
      const row = await client.contact.findUnique({ where: { phone }, select: { id: true } })
      contact = row ? await followMerged(client, row.id) : null
    }
  } else if (email) {
    const existing = await client.contact.findUnique({ where: { email }, select: { id: true } })
    contact = existing ? await followMerged(client, existing.id) : null
    if (!contact) {
      const inserted = await client.$executeRaw`
        INSERT INTO "Contact" ("id", "email", "name", "stage", "createdAt", "updatedAt")
        VALUES (${newId()}, ${email}, ${name}, 'LEAD'::"LifecycleStage", NOW(), NOW())
        ON CONFLICT ("email") DO NOTHING`
      created = inserted === 1
      const row = await client.contact.findUnique({ where: { email }, select: { id: true } })
      contact = row ? await followMerged(client, row.id) : null
    }
  }
  if (!contact) return null

  // Fill gaps only; never overwrite.
  if (email && !contact.email) {
    await client.$executeRaw`
      UPDATE "Contact" SET "email" = ${email}, "updatedAt" = NOW()
      WHERE "id" = ${contact.id} AND "email" IS NULL AND NOT EXISTS (SELECT 1 FROM "Contact" WHERE "email" = ${email})`
  }
  if (name && !contact.name) {
    await client.contact.updateMany({ where: { id: contact.id, name: null }, data: { name } })
  }
  // A customer with this phone owns the contact.
  if (phone && !contact.customerId) {
    const customer = await client.customer.findUnique({ where: { phone }, select: { id: true, mergedIntoId: true } })
    if (customer && !customer.mergedIntoId) {
      await client.$executeRaw`
        UPDATE "Contact" SET "customerId" = ${customer.id}, "updatedAt" = NOW()
        WHERE "id" = ${contact.id} AND "customerId" IS NULL AND NOT EXISTS (SELECT 1 FROM "Contact" WHERE "customerId" = ${customer.id})`
    }
  }
  return { id: contact.id, created }
}

/** Makes sure the customer has a Contact and both point at each other. Returns the contact id. */
export async function linkCustomerToContact(customerId: string, tx?: DbClient): Promise<string> {
  const client: DbClient = tx ?? db
  const c = await client.customer.findUnique({
    where: { id: customerId },
    select: { id: true, phone: true, email: true, firstName: true, lastName: true, contactId: true, mergedIntoId: true },
  })
  if (!c) throw new Error('customer not found')
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ')
  const resolved = await resolveContact({ phone: c.phone, email: c.email, name: fullName }, client)
  if (!resolved) throw new Error('customer has no usable phone')
  if (!c.mergedIntoId) {
    await client.$executeRaw`
      UPDATE "Contact" SET "customerId" = ${c.id}, "updatedAt" = NOW()
      WHERE "id" = ${resolved.id} AND "customerId" IS NULL AND NOT EXISTS (SELECT 1 FROM "Contact" WHERE "customerId" = ${c.id})`
  }
  const owner = await client.contact.findUnique({ where: { id: resolved.id }, select: { customerId: true } })
  if (owner?.customerId === c.id && c.contactId !== resolved.id) {
    await client.customer.update({ where: { id: c.id }, data: { contactId: resolved.id } })
  }
  return resolved.id
}
