import 'server-only';
import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

/** A service is public only when it and its division are active and not deleted. */
const publicService: Prisma.ServiceWhereInput = {
  isActive: true,
  deletedAt: null,
  division: { isActive: true, deletedAt: null },
};

export const getServiceBySlug = cache(async (slug: string) =>
  db.service.findFirst({
    where: { ...publicService, slugFa: slug },
    include: {
      division: true,
      faqs: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        take: 8,
      },
    },
  })
);

export async function getRelatedServices(divisionId: string, excludeId: string, take = 3) {
  return db.service.findMany({
    where: { ...publicService, divisionId, id: { not: excludeId } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    take,
    select: {
      id: true,
      slugFa: true,
      nameFa: true,
      descriptionFa: true,
      priceDisplayMode: true,
      priceFrom: true,
      priceTo: true,
    },
  });
}

export async function getPublicServicesForSitemap() {
  return db.service.findMany({
    where: { ...publicService, noindex: false },
    orderBy: { sortOrder: 'asc' },
    select: { slugFa: true, updatedAt: true, priority: true },
  });
}
