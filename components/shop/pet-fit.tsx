'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { getMyPetsForShopAction, type ShopPet } from '@/app/actions/club-shop';

let cache: Promise<ShopPet[]> | null = null;

/**
 * «مناسب برای <petName>» chips on a product page. Renders nothing for guests and for products that
 * say nothing about species or brand, so there is no empty gap and no layout shift for most visitors.
 */
export function PetFit({ forSpecies, speciesNames, brandName }: { forSpecies: string[]; speciesNames: string[]; brandName?: string | null }) {
  const [pets, setPets] = useState<ShopPet[]>([]);
  useEffect(() => {
    let live = true;
    (cache ??= (setTimeout(() => (cache = null), 30_000), getMyPetsForShopAction())).then((p) => live && setPets(p)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const brand = brandName?.trim().toLowerCase();
  const matches = pets.filter((p) => {
    if (forSpecies.length > 0 && !forSpecies.includes(p.species)) return false;
    if (forSpecies.length === 0 && speciesNames.length > 0) {
      const wants = p.species === 'DOG' ? 'سگ' : p.species === 'CAT' ? 'گربه' : null;
      if (!wants || !speciesNames.some((n) => n.includes(wants))) return false;
    }
    const brandHit = !!brand && !!p.foodBrand && p.foodBrand.trim().toLowerCase() === brand;
    return forSpecies.length > 0 || speciesNames.length > 0 || brandHit;
  });
  if (matches.length === 0) return null;
  return (
    <p data-testid="pet-fit" className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      {matches.map((p) => (
        <Link key={p.id} href={`/account/pets/${p.id}`} className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-bold text-primary">
          مناسب برای {p.name}
        </Link>
      ))}
    </p>
  );
}
