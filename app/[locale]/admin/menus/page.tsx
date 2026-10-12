import { db } from "@/lib/db";
import { MenusManager } from "@/components/admin/menus-manager";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = 'force-dynamic';

export default async function AdminMenusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin('EDITOR', locale);
  const isEn = locale === 'en';

  const menus = await db.navigationMenu.findMany({
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  return (
    <MenusManager
      menus={menus.map((m) => ({
        id: m.id,
        name: m.name,
        items: m.items.map((i) => ({
          id: i.id,
          menuId: i.menuId,
          parentId: i.parentId,
          labelFa: i.labelFa,
          labelEn: i.labelEn,
          url: i.url,
          isActive: i.isActive,
          sortOrder: i.sortOrder,
        })),
      }))}
      isEn={isEn}
    />
  );
}
