'use server'

import { revalidatePath } from 'next/cache'
import { getCustomer } from '@/lib/customer/session'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import {
  addRecordFor,
  createPetFor,
  deletePetFor,
  deleteRecordFor,
  setPetPhotoFor,
  updatePetFor,
  type PetInput,
  type PetOpResult,
  type PetRecordInput,
} from '@/lib/club/pets'
import { syncCartSnapshot } from '@/lib/club/cart'

const SESSION_EXPIRED = 'نشست شما به پایان رسیده است. دوباره وارد شوید.'
const TOO_MANY = 'درخواست‌های زیادی ثبت شده است. چند دقیقه دیگر دوباره تلاش کنید.'

export interface PetActionState extends PetOpResult {
  needsLogin?: boolean
}

/** The signed-in customer, or the error state to return. Writes share one hourly budget per person. */
async function guard(): Promise<{ id: string } | { fail: PetActionState }> {
  const customer = await getCustomer()
  if (!customer) return { fail: { ok: false, error: SESSION_EXPIRED, needsLogin: true } }
  if (!checkRateLimit(`pets:${customer.id}`, 120, 3600_000).allowed) return { fail: { ok: false, error: TOO_MANY } }
  return { id: customer.id }
}

function refresh(petId?: string) {
  revalidatePath('/account')
  revalidatePath('/account/pets')
  if (petId) revalidatePath(`/account/pets/${petId}`)
  revalidatePath('/account/club')
}

export async function createPetAction(input: PetInput): Promise<PetActionState> {
  const g = await guard()
  if ('fail' in g) return g.fail
  const res = await createPetFor(g.id, input)
  if (res.ok) refresh(res.id)
  return res
}

export async function updatePetAction(petId: string, input: PetInput): Promise<PetActionState> {
  const g = await guard()
  if ('fail' in g) return g.fail
  const res = await updatePetFor(g.id, String(petId), input)
  if (res.ok) refresh(petId)
  return res
}

export async function deletePetAction(petId: string): Promise<PetActionState> {
  const g = await guard()
  if ('fail' in g) return g.fail
  const res = await deletePetFor(g.id, String(petId))
  if (res.ok) refresh(petId)
  return res
}

export async function addPetRecordAction(petId: string, input: PetRecordInput): Promise<PetActionState> {
  const g = await guard()
  if ('fail' in g) return g.fail
  const res = await addRecordFor(g.id, String(petId), input, 'customer')
  if (res.ok) refresh(petId)
  return res
}

export async function deletePetRecordAction(recordId: string, petId?: string): Promise<PetActionState> {
  const g = await guard()
  if ('fail' in g) return g.fail
  const res = await deleteRecordFor(g.id, String(recordId))
  if (res.ok) refresh(petId)
  return res
}

/** `dataUrl` is a small image the browser has already resized (JPG/PNG/WebP, at most 200 KB); null removes the photo. */
export async function setPetPhotoAction(petId: string, dataUrl: string | null): Promise<PetActionState> {
  const g = await guard()
  if ('fail' in g) return g.fail
  if (dataUrl !== null && (typeof dataUrl !== 'string' || dataUrl.length > 300_000)) return { ok: false, error: 'حجم عکس باید کمتر از ۲۰۰ کیلوبایت باشد.' }
  const res = await setPetPhotoFor(g.id, String(petId), dataUrl)
  if (res.ok) refresh(petId)
  return res
}

/**
 * Called (debounced) by the cart provider while signed in. Silent by design: it never
 * returns details, and a failure must not disturb shopping.
 */
export async function syncCartAction(items: Array<{ productId: string; quantity: number }>): Promise<{ ok: boolean }> {
  try {
    const customer = await getCustomer()
    if (!customer) return { ok: false }
    if (!checkRateLimit(`cart-sync:${customer.id}`, 60, 600_000).allowed) return { ok: false }
    if (!Array.isArray(items)) return { ok: false }
    const res = await syncCartSnapshot(customer.id, items.slice(0, 200))
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}
