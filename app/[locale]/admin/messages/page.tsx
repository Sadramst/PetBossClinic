import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage() {
  const messages = await db.contactMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">پیام‌های فرم تماس</h1>
        <p className="text-sm text-muted-foreground">صندوق پیام‌های ارسال شده از طریق صفحه تماس با ما</p>
      </div>

      <Card className="card-luxury">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-bold text-foreground">
            پیام‌های دریافتی ({messages.length} پیام)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="text-xs uppercase bg-surface-elevated text-muted-foreground border-b border-border">
              <tr>
                <th className="px-5 py-3.5 text-start font-semibold">فرستنده</th>
                <th className="px-5 py-3.5 text-start font-semibold">تماس / ایمیل</th>
                <th className="px-5 py-3.5 text-start font-semibold">موضوع و پیام</th>
                <th className="px-5 py-3.5 text-start font-semibold">وضعیت</th>
                <th className="px-5 py-3.5 text-start font-semibold">تاریخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                    پیامی در صندوق ورودی وجود ندارد
                  </td>
                </tr>
              ) : (
                messages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-foreground">
                      {msg.name}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground font-mono">
                      <div>{msg.phone || '—'}</div>
                      <div className="text-[11px] opacity-75">{msg.email || ''}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-foreground/90 max-w-sm">
                      <div className="font-bold text-primary mb-0.5">{msg.subject || 'بدون موضوع'}</div>
                      <p className="line-clamp-2 text-muted-foreground">{msg.message}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        msg.isRead
                          ? 'text-muted-foreground bg-surface-elevated'
                          : 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                      }`}>
                        {msg.isRead ? 'خوانده شده' : 'جدید'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleDateString('fa-IR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
