export type ThemePreset = 
  | 'petboss-luxury-dark'
  | 'petboss-luxury-light'
  | 'emerald-prestige'
  | 'royal-obsidian';

export interface ThemeOption {
  id: ThemePreset;
  nameFa: string;
  nameEn: string;
  descriptionFa: string;
  descriptionEn: string;
  primaryColor: string;
  bgColor: string;
  surfaceColor: string;
  isDark: boolean;
}

export const THEME_PRESETS: ThemeOption[] = [
  {
    id: 'petboss-luxury-dark',
    nameFa: 'لوکس مشکی و طلایی پت باس (اصلی)',
    nameEn: 'Pet Boss Luxury Dark (Signature)',
    descriptionFa: 'تم پیش‌فرض منطبق بر هویت بصری، ذغالی مات عمیق با طلایی متالیک',
    descriptionEn: 'Default signature identity with deep matte charcoal and metallic gold',
    primaryColor: '#c5a059',
    bgColor: '#181a20',
    surfaceColor: '#23272f',
    isDark: true,
  },
  {
    id: 'petboss-luxury-light',
    nameFa: 'لوکس روشن کرم و طلایی',
    nameEn: 'Pet Boss Luxury Light',
    descriptionFa: 'پوسته‌ای روشن و مجلل با زمینه کرم ابریشمی و طلایی براق',
    descriptionEn: 'Opulent light theme with silk cream background and warm gold',
    primaryColor: '#b58d3c',
    bgColor: '#fbf9f5',
    surfaceColor: '#ffffff',
    isDark: false,
  },
  {
    id: 'emerald-prestige',
    nameFa: 'سبز زمردی اشرافی و طلا',
    nameEn: 'Emerald Prestige',
    descriptionFa: 'سبز تیره جنگلی شاهانه همراه با هایلایت‌های برنجی و طلایی',
    descriptionEn: 'Deep forest emerald green accented with polished brass and gold',
    primaryColor: '#d4ab44',
    bgColor: '#0c1813',
    surfaceColor: '#182e25',
    isDark: true,
  },
  {
    id: 'royal-obsidian',
    nameFa: 'آبسیدین سیاه شب و شامپاین',
    nameEn: 'Royal Obsidian',
    descriptionFa: 'سیاه خالص آبسیدین با لمس ملایم طلای شامپاین',
    descriptionEn: 'Ultra-dark obsidian black with champagne gold accents',
    primaryColor: '#e5c06e',
    bgColor: '#0d0e10',
    surfaceColor: '#1a1c22',
    isDark: true,
  },
];
