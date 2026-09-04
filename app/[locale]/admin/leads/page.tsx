import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

export default async function AdminLeadsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';

  const leads = await db.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isEn ? 'Inquiries & Appointment Leads' : 'سرنخ‌ها و درخواست‌های نوبت'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEn
            ? 'Consultation requests and appointment booking inquiries registered by visitors'
            : 'درخواست‌های مشاوره و رزرو وقت آنلاین ثبت شده توسط مراجعین'}
        </p>
      </div>

      <Card className="card-luxury">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-bold text-foreground">
            {isEn ? `Leads Inbox (${leads.length} entries)` : `لیست درخواست‌ها (${leads.length} مورد)`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="text-xs uppercase bg-surface-elevated text-muted-foreground border-b border-border">
              <tr>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Client Name' : 'نام متقاضی'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Phone Number' : 'شماره تماس'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Message / Source' : 'پیام / منبع'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Status' : 'وضعیت'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Created At' : 'تاریخ ثبت'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Action' : 'اقدام'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                    {isEn ? 'No lead records logged in the system yet' : 'سرنخی در سیستم ثبت نشده است'}
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-foreground">
                      {lead.name || (isEn ? 'Anonymous Client' : 'مراجعه‌کننده ناشناس')}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-primary">
                      {lead.phone}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs truncate">
                      {lead.message || lead.source || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-medium">
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleDateString(isEn ? 'en-US' : 'fa-IR')}
                    </td>
                    <td className="px-5 py-4">
                      <button className="text-xs text-primary hover:underline font-bold">
                        {isEn ? 'Review' : 'بررسی'}
                      </button>
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
