'use server'

import { getCustomer } from '@/lib/customer/session'
import { getMyCoupons } from '@/lib/marketing/my-coupons'

/** Lets the welcome popup stay away from customers who already hold a welcome code. */
export async function getMarketingViewerAction(): Promise<{ signedIn: boolean; hasWelcomeCode: boolean }> {
  try {
    const customer = await getCustomer()
    if (!customer) return { signedIn: false, hasWelcomeCode: false }
    const list = await getMyCoupons(customer)
    return { signedIn: true, hasWelcomeCode: list.some((c) => c.kind === 'welcome') }
  } catch {
    return { signedIn: false, hasWelcomeCode: false }
  }
}
