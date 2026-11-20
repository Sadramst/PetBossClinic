import { notFound } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/guard';
import { getCustomer360 } from '@/lib/club/customers-admin';
import { getLoyaltyConfig } from '@/lib/club/config';
import { tierByKey, tierProgress } from '@/lib/club/tiers';
import { buildInsights } from '@/lib/club/ai';
import { senderStatus } from '@/lib/club/messaging/sender';
import { formatJalaliDate } from '@/lib/shop/expiry';
import { formatJalaliDateTime } from '@/components/admin/format';
import { dueStatus } from '@/lib/club/pet-math';
import { Customer360, type C360Props } from '@/components/admin/customer-360';
import { getCustomerTimeline } from '@/lib/crm/timeline';
import { listStaffOptions } from '@/lib/crm/staff';
import { CustomerHealthCard } from '@/components/admin/crm/customer-health-card';
import { Timeline } from '@/components/admin/crm/timeline';

export const dynamic = 'force-dynamic';

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');

export default async function AdminCustomer360Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const session = await requireAdmin('EDITOR', locale);
  const data = await getCustomer360(id);
  if (!data) notFound();
  const { customer: c, pets, visits, orders, ledger, coupons, notes, cart, messages } = data;
  const [cfg, insights, services, staff, timeline, openTasks, openLeads, openTickets] = await Promise.all([
    getLoyaltyConfig(),
    buildInsights(id),
    db.service.findMany({ select: { id: true, nameFa: true }, orderBy: { nameFa: 'asc' }, take: 300 }),
    listStaffOptions(),
    getCustomerTimeline(id, { take: 30 }),
    db.crmTask.count({ where: { customerId: id, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    db.lead.count({ where: { customerId: id, stage: { notIn: ['WON', 'LOST'] } } }),
    db.contactMessage.count({ where: { customerId: id, status: { in: ['OPEN', 'PENDING'] } } }),
  ]);
  const tier = tierByKey(cfg.tiers, c.tier);
  const prog = tierProgress(cfg.tiers, c.lifetimePoints);
  const cartItems = (Array.isArray(cart?.items) ? cart.items : []) as unknown as Array<{ name: string; quantity: number; price: number }>;
  const now = new Date();

  const props: C360Props = {
    isAdmin: session.role === 'ADMIN' || session.role === 'SUPER_ADMIN',
    senderNote: senderStatus().message,
    customer: {
      id: c.id,
      firstName: c.firstName ?? '',
      lastName: c.lastName ?? '',
      phone: c.phone,
      email: c.email ?? '',
      city: c.city ?? '',
      gender: c.gender ?? '',
      birthDate: iso(c.birthDate),
      tags: c.tags.join('، '),
      source: c.source ?? '',
      notes: c.notes ?? '',
      tier: c.tier,
      tierLabel: tier.label,
      tierColor: tier.color,
      nextTier: prog.next ? `${prog.next.label} (${prog.remaining.toLocaleString('fa-IR')} امتیاز مانده)` : null,
      progressPercent: prog.percent,
      points: c.pointsBalance,
      lifetime: c.lifetimePoints,
      spent: c.totalSpent,
      orders: c.ordersCount,
      lastOrder: c.lastOrderAt ? formatJalaliDate(c.lastOrderAt) : null,
      consent: c.marketingSmsConsent,
      consentAt: c.marketingConsentAt ? formatJalaliDateTime(c.marketingConsentAt) : null,
      joined: formatJalaliDate(c.createdAt),
      createdByAdmin: c.createdByAdmin,
      referralCode: c.referralCode ?? '',
      blocked: c.isBlocked,
      pointValueToman: cfg.pointValueToman,
    },
    insights: insights.map((i) => ({ id: i.id, title: i.title, reason: i.reason, type: i.action.type })),
    pets: pets.map((p) => ({
      id: p.id,
      name: p.name,
      species: p.species,
      breed: p.breed ?? '',
      sex: p.sex,
      birthDate: iso(p.birthDate),
      weightKg: p.weightKg ?? null,
      neutered: p.neutered,
      foodBrand: p.foodBrand ?? '',
      allergies: p.allergies ?? '',
      medicalNotes: p.medicalNotes ?? '',
      isActive: p.isActive,
      records: p.records.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        done: formatJalaliDate(r.doneAt),
        next: r.nextDueAt ? formatJalaliDate(r.nextDueAt) : null,
        due: dueStatus(r.nextDueAt, now),
        value: r.valueNumber ?? null,
        notes: r.notes ?? '',
        source: r.source,
      })),
    })),
    visits: visits.map((v) => ({
      id: v.id,
      petId: v.petId ?? '',
      petName: v.pet?.name ?? '',
      serviceId: v.serviceId ?? '',
      serviceName: v.serviceName,
      date: formatJalaliDate(v.visitedAt),
      dateIso: iso(v.visitedAt),
      amount: v.amount,
      doctor: v.doctor ?? '',
      notes: v.notes ?? '',
      points: v.pointsAwarded,
    })),
    services: services.map((s) => ({ id: s.id, name: s.nameFa })),
    orders: orders.map((o) => ({ id: o.id, number: o.number, status: o.status, total: o.total, date: formatJalaliDate(o.createdAt) })),
    ledger: ledger.map((t) => ({ id: t.id, kind: t.kind, points: t.points, balance: t.balanceAfter, note: t.note ?? '', date: formatJalaliDateTime(t.createdAt) })),
    coupons: coupons.map((k) => ({
      id: k.id,
      code: k.code,
      title: k.title ?? '',
      active: k.isActive,
      used: k.usedCount > 0,
      source: k.source ?? '',
      ends: k.endsAt ? formatJalaliDate(k.endsAt) : null,
    })),
    notes: notes.map((n) => ({ id: n.id, body: n.body, by: n.adminName ?? 'مدیر', date: formatJalaliDateTime(n.createdAt) })),
    cart: cart ? { items: cartItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })), subtotal: cart.subtotal, updated: formatJalaliDateTime(cart.updatedAt), reminded: cart.lastReminderAt ? formatJalaliDateTime(cart.lastReminderAt) : null } : null,
    messages: messages.map((m) => ({ id: m.id, kind: m.kind, body: m.body, status: m.status, date: formatJalaliDateTime(m.createdAt), error: m.error ?? '' })),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <nav aria-label="مسیر" className="text-xs text-muted-foreground">
        <Link href="/admin/customers" className="hover:text-primary">
          مشتریان
        </Link>
        <span aria-hidden> / </span>
        <span>{[c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone}</span>
      </nav>
      <CustomerHealthCard
        customerId={c.id}
        lifecycle={c.lifecycleStage}
        health={c.healthScore}
        churn={c.churnRisk}
        ownerId={c.ownerId}
        lastContactedAt={c.lastContactedAt ? c.lastContactedAt.toISOString() : null}
        staff={staff}
        counts={{ openTasks, openLeads, openTickets }}
      />
      <Customer360 {...props} />
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4" aria-labelledby="timeline-title">
        <h2 id="timeline-title" className="text-base font-extrabold">
          تاریخچهٔ یکپارچه
        </h2>
        <Timeline
          customerId={c.id}
          initialCursor={timeline.nextCursor}
          initial={timeline.items.map((i) => ({ key: i.key, type: i.type, label: i.label, summary: i.summary, occurredAt: i.occurredAt.toISOString(), href: i.href }))}
        />
      </section>
    </div>
  );
}
