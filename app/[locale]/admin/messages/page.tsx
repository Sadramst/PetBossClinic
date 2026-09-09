import { db } from "@/lib/db";
import { MessagesManager } from "@/components/admin/messages-manager";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin('VIEWER', locale);
  const isEn = locale === 'en';

  const messages = await db.contactMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <MessagesManager
      messages={messages}
      isEn={isEn}
    />
  );
}
