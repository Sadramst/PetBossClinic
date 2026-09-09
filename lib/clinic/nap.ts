/**
 * @file nap.ts
 * @description Dynamic database accessor for Clinic Name, Address, Phone (NAP),
 * Working Hours, and Social Links.
 * Resolves directly from `SiteSetting` and `WorkingHour` in the database,
 * cached with Next.js `unstable_cache` with tag-based on-demand revalidation.
 */

import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { formatPhoneDisplay, getTelLink, toPersianDigits } from '@/lib/utils/phone';

export interface WorkingHourItem {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  dayLabelFa: string;
  dayLabelEn: string;
}

export interface ClinicNAP {
  nameFa: string;
  nameEn: string;
  phone: string;
  phoneDisplayFa: string;
  phoneDisplayEn: string;
  telLink: string;
  whatsappNumber: string | null;
  whatsappLink: string | null;
  email: string;
  addressFa: string;
  addressEn: string;
  geo: {
    lat: number;
    lng: number;
  };
  workingHoursSummaryFa: string;
  workingHoursSummaryEn: string;
  workingHours: WorkingHourItem[];
  instagramUrl: string | null;
  telegramUrl: string | null;
}

const DAY_LABELS = [
  { fa: 'شنبه', en: 'Saturday' },
  { fa: 'یکشنبه', en: 'Sunday' },
  { fa: 'دوشنبه', en: 'Monday' },
  { fa: 'سه‌شنبه', en: 'Tuesday' },
  { fa: 'چهارشنبه', en: 'Wednesday' },
  { fa: 'پنج‌شنبه', en: 'Thursday' },
  { fa: 'جمعه', en: 'Friday' },
];

/**
 * Low-level database fetcher querying SiteSetting, WorkingHour, and SocialLink.
 */
async function fetchClinicNAPFromDB(): Promise<ClinicNAP> {
  const [siteSetting, workingHoursDb, socialLinksDb] = await Promise.all([
    db.siteSetting.findFirst().catch(() => null),
    db.workingHour.findMany({ orderBy: { dayOfWeek: 'asc' } }).catch(() => []),
    db.socialLink.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }).catch(() => []),
  ]);

  // Verified defaults (landline is clinic's real number +982126429715)
  let phone = '+982126429715';
  let waNumber: string | null = null;
  let waLink: string | null = null;
  let email = 'info@petbossclinic.com';
  let addressFa = 'تهران، خیابان شریعتی، نرسیده به مترو قیطریه، پلاک ۱۷۳۳';
  let addressEn = 'No. 1733, Shariati St., near Gheytariyeh Metro Station, Tehran, Iran';
  let lat = 35.790937;
  let lng = 51.4350853;
  let nameFa = 'کلینیک تخصصی دامپزشکی و پت‌شاپ پت‌باس';
  let nameEn = 'Pet Boss Clinic & Luxury Pet Shop';

  if (siteSetting) {
    if (siteSetting.nameFa) nameFa = siteSetting.nameFa;
    if (siteSetting.nameEn) nameEn = siteSetting.nameEn;
    if (siteSetting.phones) {
      if (Array.isArray(siteSetting.phones)) {
        const first = siteSetting.phones[0];
        if (typeof first === 'string' && first.trim()) {
          phone = first.trim();
        }
      } else if (typeof siteSetting.phones === 'object') {
        const p = siteSetting.phones as Record<string, string | undefined>;
        if (p.primary || p.landline) {
          phone = (p.primary || p.landline)!;
        }
        if (p.whatsapp || p.mobile) {
          waNumber = (p.whatsapp || p.mobile)!;
          waLink = `https://wa.me/${waNumber.replace(/\D/g, '')}`;
        }
      } else if (typeof siteSetting.phones === 'string') {
        phone = siteSetting.phones;
      }
    }
    if (siteSetting.emails && typeof siteSetting.emails === 'object') {
      const e = siteSetting.emails as Record<string, string | undefined>;
      if (e.primary || e.info) email = (e.primary || e.info)!;
    }
    if (siteSetting.addresses && typeof siteSetting.addresses === 'object') {
      const a = siteSetting.addresses as Record<string, string | undefined>;
      if (a.fa) addressFa = a.fa;
      if (a.en) addressEn = a.en;
    }
    if (siteSetting.geo && typeof siteSetting.geo === 'object') {
      const g = siteSetting.geo as Record<string, number | undefined>;
      if (typeof g.lat === 'number' && typeof g.lng === 'number') {
        lat = g.lat;
        lng = g.lng;
      }
    }
  }

  let instagramUrl: string | null = null;
  let telegramUrl: string | null = null;
  for (const s of socialLinksDb) {
    if (s.platform === 'INSTAGRAM') instagramUrl = s.url;
    if (s.platform === 'TELEGRAM') telegramUrl = s.url;
    if (s.platform === 'WHATSAPP' && s.url) {
      waLink = s.url;
      const match = s.url.match(/wa\.me\/(\d+)/);
      if (match) waNumber = `+${match[1]}`;
    }
  }

  const workingHours: WorkingHourItem[] = workingHoursDb.map((wh) => ({
    dayOfWeek: wh.dayOfWeek,
    openTime: wh.openTime,
    closeTime: wh.closeTime,
    isClosed: wh.isClosed,
    dayLabelFa: DAY_LABELS[wh.dayOfWeek]?.fa || `روز ${wh.dayOfWeek}`,
    dayLabelEn: DAY_LABELS[wh.dayOfWeek]?.en || `Day ${wh.dayOfWeek}`,
  }));

  let workingHoursSummaryFa = '۱۰:۰۰ الی ۲۲:۰۰ (همه روزه)';
  let workingHoursSummaryEn = '10:00 AM – 10:00 PM (Everyday)';

  if (workingHours.length > 0) {
    const sample = workingHours[0];
    const allSame = workingHours.every(
      (wh) => !wh.isClosed && wh.openTime === sample.openTime && wh.closeTime === sample.closeTime
    );
    if (allSame) {
      workingHoursSummaryFa = `همه روزه: ${toPersianDigits(sample.openTime)} الی ${toPersianDigits(sample.closeTime)}`;
      workingHoursSummaryEn = `Everyday: ${sample.openTime} – ${sample.closeTime}`;
    }
  }

  return {
    nameFa,
    nameEn,
    phone,
    phoneDisplayFa: formatPhoneDisplay(phone, 'fa'),
    phoneDisplayEn: formatPhoneDisplay(phone, 'en'),
    telLink: getTelLink(phone),
    whatsappNumber: waNumber,
    whatsappLink: waLink,
    email,
    addressFa,
    addressEn,
    geo: { lat, lng },
    workingHoursSummaryFa,
    workingHoursSummaryEn,
    workingHours,
    instagramUrl,
    telegramUrl,
  };
}

/**
 * Returns cached Clinic NAP data with tag-based invalidation.
 */
export const getClinicNAP = unstable_cache(
  fetchClinicNAPFromDB,
  ['clinic-nap-cache'],
  {
    revalidate: 3600,
    tags: ['site-settings', 'working-hours', 'clinic-nap'],
  }
);
