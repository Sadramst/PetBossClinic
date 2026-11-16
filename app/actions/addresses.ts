'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getCustomer } from '@/lib/customer/session'
import { isIranProvince, normalizeMobile, normalizePostalCode } from '@/lib/text/iran'
import { normalizeFa } from '@/lib/text/persian'
import { toLatinDigits } from '@/lib/date/jalali'

export interface AddressActionState {
  error?: string
  ok?: boolean
  addressId?: string
}

const MAX_ADDRESSES = 10

export async function saveAddressAction(formData: FormData): Promise<AddressActionState> {
  const customer = await getCustomer()
  if (!customer) return { error: 'ابتدا وارد حساب کاربری شوید.' }

  const get = (k: string) => normalizeFa(formData.get(k)?.toString() ?? '')
  const id = formData.get('id')?.toString() || null
  const province = get('province')
  const city = get('city').slice(0, 60)
  const addressLine = get('addressLine').slice(0, 300)
  const recipientName = get('recipientName').slice(0, 80)
  const recipientPhone = normalizeMobile(formData.get('recipientPhone')?.toString() ?? '')
  const postalCode = normalizePostalCode(formData.get('postalCode')?.toString() ?? '')
  const plaque = toLatinDigits(get('plaque')).slice(0, 10) || null
  const unit = toLatinDigits(get('unit')).slice(0, 10) || null
  const title = get('title').slice(0, 40) || null
  const latRaw = Number(formData.get('lat'))
  const lngRaw = Number(formData.get('lng'))

  if (!isIranProvince(province)) return { error: 'استان را انتخاب کنید.' }
  if (city.length < 2) return { error: 'شهر را وارد کنید.' }
  if (addressLine.length < 10) return { error: 'نشانی را کامل‌تر وارد کنید (خیابان، کوچه، نشانه).' }
  if (recipientName.length < 3) return { error: 'نام تحویل‌گیرنده را وارد کنید.' }
  if (!recipientPhone) return { error: 'شماره موبایل تحویل‌گیرنده معتبر نیست.' }
  if (!postalCode) return { error: 'کد پستی باید ۱۰ رقم و معتبر باشد.' }

  const data = {
    province,
    city,
    addressLine,
    recipientName,
    recipientPhone,
    postalCode,
    plaque,
    unit,
    title,
    lat: Number.isFinite(latRaw) && latRaw !== 0 ? latRaw : null,
    lng: Number.isFinite(lngRaw) && lngRaw !== 0 ? lngRaw : null,
  }

  let addressId: string
  if (id) {
    const owned = await db.address.findFirst({ where: { id, customerId: customer.id, deletedAt: null } })
    if (!owned) return { error: 'نشانی پیدا نشد.' }
    addressId = (await db.address.update({ where: { id }, data })).id
  } else {
    const count = await db.address.count({ where: { customerId: customer.id, deletedAt: null } })
    if (count >= MAX_ADDRESSES) return { error: 'حداکثر ۱۰ نشانی می‌توانید ذخیره کنید.' }
    addressId = (await db.address.create({ data: { ...data, customerId: customer.id, isDefault: count === 0 } })).id
  }

  revalidatePath('/account/addresses')
  revalidatePath('/checkout')
  return { ok: true, addressId }
}

export async function deleteAddressAction(id: string): Promise<AddressActionState> {
  const customer = await getCustomer()
  if (!customer) return { error: 'ابتدا وارد حساب کاربری شوید.' }
  const res = await db.address.updateMany({
    where: { id, customerId: customer.id, deletedAt: null },
    data: { deletedAt: new Date(), isDefault: false },
  })
  if (!res.count) return { error: 'نشانی پیدا نشد.' }
  revalidatePath('/account/addresses')
  return { ok: true }
}

export async function setDefaultAddressAction(id: string): Promise<AddressActionState> {
  const customer = await getCustomer()
  if (!customer) return { error: 'ابتدا وارد حساب کاربری شوید.' }
  const owned = await db.address.findFirst({ where: { id, customerId: customer.id, deletedAt: null } })
  if (!owned) return { error: 'نشانی پیدا نشد.' }
  await db.$transaction([
    db.address.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } }),
    db.address.update({ where: { id }, data: { isDefault: true } }),
  ])
  revalidatePath('/account/addresses')
  return { ok: true }
}
