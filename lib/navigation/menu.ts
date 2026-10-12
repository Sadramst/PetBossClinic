import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';

export interface NavItem {
  id: string;
  labelFa: string;
  labelEn: string | null;
  url: string;
  sortOrder: number;
  isActive: boolean;
  parentId?: string | null;
  children?: NavItem[];
}

const DEFAULT_ITEMS = [
  { labelFa: 'خانه', labelEn: 'Home', url: '/', sortOrder: 1 },
  { labelFa: 'خدمات', labelEn: 'Services', url: '/services', sortOrder: 2 },
  { labelFa: 'پت‌شاپ', labelEn: 'Shop', url: '/shop', sortOrder: 3 },
  { labelFa: 'درباره ما', labelEn: 'About', url: '/about', sortOrder: 4 },
  { labelFa: 'سوالات متداول', labelEn: 'FAQ', url: '/faq', sortOrder: 5 },
  { labelFa: 'تماس با ما', labelEn: 'Contact', url: '/contact', sortOrder: 6 },
];

async function fetchMenuFromDb(menuName: string): Promise<NavItem[]> {
  try {
    let menu = await db.navigationMenu.findUnique({
      where: { name: menuName },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!menu || menu.items.length === 0) {
      // Auto-initialize default menu if not exists
      if (!menu) {
        menu = await db.navigationMenu.create({
          data: { name: menuName },
          include: { items: true },
        });
      }

      await db.menuItem.createMany({
        data: DEFAULT_ITEMS.map((item) => ({
          menuId: menu!.id,
          labelFa: item.labelFa,
          labelEn: item.labelEn,
          url: item.url,
          sortOrder: item.sortOrder,
          isActive: true,
        })),
      });

      menu = await db.navigationMenu.findUnique({
        where: { name: menuName },
        include: {
          items: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    }

    if (!menu) return DEFAULT_ITEMS.map((item, idx) => ({ ...item, id: `def-${idx}`, isActive: true }));

    return menu.items.map((i) => ({
      id: i.id,
      labelFa: i.labelFa,
      labelEn: i.labelEn,
      url: i.url,
      sortOrder: i.sortOrder,
      isActive: i.isActive,
      parentId: i.parentId,
    }));
  } catch (err) {
    console.error(`Error querying navigation menu ${menuName}:`, err);
    return DEFAULT_ITEMS.map((item, idx) => ({ ...item, id: `fallback-${idx}`, isActive: true }));
  }
}

export const getNavigationMenu = unstable_cache(
  fetchMenuFromDb,
  ['navigation-menu-cache'],
  {
    revalidate: 3600,
    tags: ['navigation', 'site-settings'],
  }
);
