import { db } from '@/lib/db'

export interface SitePictures {
  site_logo: string
  site_signboard: string
  hero_reception: string
  division_veterinary: string
  division_grooming: string
  division_petshop: string
  about_clinic: string
  about_veterinarian: string
}

export const DEFAULT_SITE_PICTURES: SitePictures = {
  site_logo: '/images/logo.png',
  site_signboard: '/images/petboss-signboard.jpg',
  hero_reception: '/images/reception.jpg',
  division_veterinary: '/images/veterinarian.jpg',
  division_grooming: '/images/grooming.jpg',
  division_petshop: '/images/petshop.jpg',
  about_clinic: '/images/reception.jpg',
  about_veterinarian: '/images/veterinarian.jpg',
}

export async function getSitePictures(): Promise<SitePictures> {
  try {
    const records = await db.media.findMany({
      where: {
        key: {
          in: Object.keys(DEFAULT_SITE_PICTURES),
        },
      },
    })

    const result = { ...DEFAULT_SITE_PICTURES }
    for (const rec of records) {
      if (rec.key in result && rec.url) {
        // @ts-expect-error dynamic key assignment
        result[rec.key] = rec.url
      }
    }
    return result
  } catch (err) {
    console.error('Error fetching site pictures from DB, falling back to defaults:', err)
    return DEFAULT_SITE_PICTURES
  }
}
