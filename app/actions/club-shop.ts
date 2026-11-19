'use server'

import { getCustomer } from '@/lib/customer/session'
import { listPets } from '@/lib/club/pets'

export interface ShopPet {
  id: string
  name: string
  species: string
  foodBrand: string | null
}

/** The signed-in customer's pets, for the «مناسب برای …» chips in the shop. Empty for guests. */
export async function getMyPetsForShopAction(): Promise<ShopPet[]> {
  try {
    const customer = await getCustomer()
    if (!customer) return []
    const pets = await listPets(customer.id)
    return pets.slice(0, 8).map((p) => ({ id: p.id, name: p.name, species: p.species, foodBrand: p.foodBrand }))
  } catch {
    return []
  }
}
