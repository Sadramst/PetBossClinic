/**
 * @file nap.ts
 * @description Centralized single-source-of-truth for Name, Address, Phone (NAP),
 * Working Hours, and Social Links. Read from DB with fallback defaults.
 */

import { db } from '@/lib/db';
import { formatPhoneDisplay, getTelLink, getWhatsAppLink, toPersianDigits } from '@/lib/utils/phone';

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
  whatsappNumber: string;
  whatsappLink: string;
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
  instagramUrl: string;
  telegramUrl: string;
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

export const DEFAULT_CLINIC_NAP: ClinicNAP = {
  nameFa: 'کلینیک تخصصی دامپزشکی و پت‌شاپ پت‌باس',
  nameEn: 'Pet Boss Clinic & Luxury Pet Shop',
  phone: '+982126429715',
  phoneDisplayFa: '۰۲۱-۲۶۴۲۹۷۱۵',
  phoneDisplayEn: '+98 21 2642 9715',
  telLink: 'tel:+982126429715',
  whatsappNumber: '+989122642971',
  whatsappLink: 'https://wa.me/989122642971',
  email: 'info@petbossclinic.com',
  addressFa: 'تهران، خیابان شریعتی، نرسیده به مترو قیطریه، پلاک ۱۷۳۳',
  addressEn: 'No. 1733, Shariati St., near Gheytariyeh Metro Station, Tehran, Iran',
  geo: {
    lat: 35.790937,
    lng: 51.4350853,
  },
  workingHoursSummaryFa: 'همه روزه (شنبه تا جمعه): ۱۰:۰۰ الی ۲۲:۰۰',
  workingHoursSummaryEn: 'Everyday (Saturday to Friday): 10:00 AM – 10:00 PM',
  workingHours: DAY_LABELS.map((label, dayOfWeek) => ({
    dayOfWeek,
    openTime: '10:00',
    closeTime: '22:00',
    isClosed: false,
    dayLabelFa: label.fa,
    dayLabelEn: label.en,
  })),
  instagramUrl: 'https://instagram.com/petbossclinic',
  telegramUrl: 'https://t.me/petbossclinic',
};

/**
 * Retrieves the unified Clinic NAP and operational hours from the database.
 * Returns verified fallback defaults if database query fails or records are unpopulated.
 */
export async function getClinicNAP(): Promise<ClinicNAP> {
  try {
    const [siteSetting, workingHoursDb, socialLinksDb] = await Promise.all([
      db.siteSetting.findFirst().catch(() => null),
      db.workingHour.findMany({ orderBy: { dayOfWeek: 'asc' } }).catch(() => []),
      db.socialLink.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }).catch(() => []),
    ]);

    const result = { ...DEFAULT_CLINIC_NAP };

    // 1. Process Working Hours from DB (Single Source of Truth)
    if (workingHoursDb && workingHoursDb.length > 0) {
      result.workingHours = workingHoursDb.map((wh) => ({
        dayOfWeek: wh.dayOfWeek,
        openTime: wh.openTime,
        closeTime: wh.closeTime,
        isClosed: wh.isClosed,
        dayLabelFa: DAY_LABELS[wh.dayOfWeek]?.fa || `روز ${wh.dayOfWeek}`,
        dayLabelEn: DAY_LABELS[wh.dayOfWeek]?.en || `Day ${wh.dayOfWeek}`,
      }));

      // Compute consistent summary
      const sample = workingHoursDb[0];
      const allSame = workingHoursDb.every(
        (wh) => !wh.isClosed && wh.openTime === sample.openTime && wh.closeTime === sample.closeTime
      );

      if (allSame && sample) {
        result.workingHoursSummaryFa = `همه روزه (شنبه تا جمعه): ${toPersianDigits(sample.openTime)} الی ${toPersianDigits(sample.closeTime)}`;
        result.workingHoursSummaryEn = `Everyday: ${sample.openTime} – ${sample.closeTime}`;
      }
    }

    // 2. Process Social Links from DB
    if (socialLinksDb && socialLinksDb.length > 0) {
      for (const link of socialLinksDb) {
        if (link.platform === 'INSTAGRAM' && link.url) result.instagramUrl = link.url;
        if (link.platform === 'TELEGRAM' && link.url) result.telegramUrl = link.url;
        if (link.platform === 'WHATSAPP' && link.url) {
          result.whatsappLink = link.url;
          const match = link.url.match(/wa\.me\/(\d+)/);
          if (match) {
            result.whatsappNumber = `+${match[1]}`;
          }
        }
      }
    }

    // 3. Process Site Settings from DB
    if (siteSetting) {
      if (siteSetting.nameFa) result.nameFa = siteSetting.nameFa;
      if (siteSetting.nameEn) result.nameEn = siteSetting.nameEn;
      
      if (siteSetting.phones && typeof siteSetting.phones === 'object') {
        // @ts-expect-error JSON phones field
        const primaryPhone = siteSetting.phones.primary || siteSetting.phones.landline;
        if (primaryPhone) {
          result.phone = primaryPhone;
          result.phoneDisplayFa = formatPhoneDisplay(primaryPhone, 'fa');
          result.phoneDisplayEn = formatPhoneDisplay(primaryPhone, 'en');
          result.telLink = getTelLink(primaryPhone);
        }
        // @ts-expect-error JSON phones field
        const wa = siteSetting.phones.whatsapp || siteSetting.phones.mobile;
        if (wa) {
          result.whatsappNumber = wa;
          result.whatsappLink = getWhatsAppLink(wa);
        }
      }

      if (siteSetting.emails && typeof siteSetting.emails === 'object') {
        // @ts-expect-error JSON emails field
        const primaryEmail = siteSetting.emails.primary || siteSetting.emails.info;
        if (primaryEmail) result.email = primaryEmail;
      }

      if (siteSetting.addresses && typeof siteSetting.addresses === 'object') {
        // @ts-expect-error JSON addresses field
        if (siteSetting.addresses.fa) result.addressFa = siteSetting.addresses.fa;
        // @ts-expect-error JSON addresses field
        if (siteSetting.addresses.en) result.addressEn = siteSetting.addresses.en;
      }

      if (siteSetting.geo && typeof siteSetting.geo === 'object') {
        // @ts-expect-error JSON geo field
        if (siteSetting.geo.lat && siteSetting.geo.lng) {
          // @ts-expect-error JSON geo field
          result.geo = { lat: siteSetting.geo.lat, lng: siteSetting.geo.lng };
        }
      }
    }

    return result;
  } catch {
    return DEFAULT_CLINIC_NAP;
  }
}
