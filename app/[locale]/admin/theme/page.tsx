'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useTheme, THEME_PRESETS, ThemePreset } from '@/lib/theme';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LuxuryPillBadge } from '@/components/ui/luxury-pill-badge';
import { PetBossLogo } from '@/components/shared/pet-boss-logo';

export default function AdminThemePage() {
  const { theme, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<ThemePreset>(theme);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const locale = useLocale();
  const isEn = locale === 'en';

  const handleApplyTheme = (presetId: ThemePreset) => {
    setSelectedTheme(presetId);
    setTheme(presetId);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🎨</span>
          <h1 className="text-2xl font-bold text-foreground">
            {isEn ? 'Dynamic Theme Studio & Brand Manager' : 'مدیریت و تغییر پویای قالب سایت'}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {isEn
            ? 'Select and customize the visual identity of Pet Boss Clinic. Any selected theme applies immediately site-wide.'
            : 'انتخاب و سفارشی‌سازی هویت بصری کلینیک پت‌باس. هر تغییری که اعمال کنید، بلافاصله در کل سایت فعال می‌شود.'}
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span className="text-sm font-bold">
              {isEn ? 'Theme applied and saved successfully!' : 'قالب با موفقیت تغییر کرد و ذخیره شد!'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {isEn ? 'Persistent 1-year cookie set' : 'کوکی ماندگار ۱ ساله تنظیم شد'}
          </span>
        </div>
      )}

      {/* Preset Theme Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {THEME_PRESETS.map((preset) => {
          const isCurrentActive = theme === preset.id;
          const isSelected = selectedTheme === preset.id;

          return (
            <Card
              key={preset.id}
              onClick={() => handleApplyTheme(preset.id)}
              className={`cursor-pointer transition-all duration-300 relative overflow-hidden border-2 ${
                isCurrentActive
                  ? 'border-primary shadow-gold ring-1 ring-primary'
                  : isSelected
                  ? 'border-border-gold'
                  : 'border-border hover:border-border-gold/60'
              } bg-surface-card`}
            >
              {isCurrentActive && (
                <div className="absolute top-3 end-3 bg-primary text-charcoal-950 font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow">
                  {isEn ? 'Active Theme' : 'قالب فعال فعلی'}
                </div>
              )}

              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full border border-white/20 shadow-sm flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: preset.primaryColor, color: preset.bgColor }}
                  >
                    ★
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      {isEn ? preset.nameEn : preset.nameFa}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{isEn ? preset.nameFa : preset.nameEn}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isEn ? preset.descriptionEn : preset.descriptionFa}
                </p>

                {/* Color Swatch Bars */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{isEn ? 'Palette:' : 'رنگ‌ها:'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 ms-auto">
                    <span
                      className="w-5 h-5 rounded-md border border-white/20 shadow-sm"
                      style={{ backgroundColor: preset.bgColor }}
                      title={isEn ? 'Background' : 'رنگ پس‌زمینه'}
                    />
                    <span
                      className="w-5 h-5 rounded-md border border-white/20 shadow-sm"
                      style={{ backgroundColor: preset.surfaceColor }}
                      title={isEn ? 'Surface Cards' : 'رنگ کارت‌ها'}
                    />
                    <span
                      className="w-5 h-5 rounded-md border border-white/20 shadow-sm"
                      style={{ backgroundColor: preset.primaryColor }}
                      title={isEn ? 'Primary Gold' : 'رنگ طلایی شاخص'}
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={isCurrentActive ? "default" : "outline"}
                  className={`w-full rounded-lg text-xs font-semibold ${
                    isCurrentActive
                      ? 'bg-gradient-gold text-charcoal-950 shadow-gold'
                      : 'border-border text-foreground hover:bg-surface-elevated'
                  }`}
                >
                  {isCurrentActive
                    ? (isEn ? 'Theme Currently Active' : 'قالب هم‌اکنون فعال است')
                    : (isEn ? 'Activate This Theme' : 'فعال‌سازی این قالب')}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Live Preview Box */}
      <div className="p-8 rounded-2xl bg-surface border border-border-gold shadow-gold-lg space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span>{isEn ? 'Live Component Preview' : 'پیش‌نمایش زنده المان‌های قالب'}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-mono">
                Live Preview
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isEn
                ? 'Real-time appearance of components in the active palette:'
                : 'نمای المان‌ها با تغییر آنی به قالب انتخابی:'}
            </p>
          </div>
          <PetBossLogo size="sm" variant="gold" />
        </div>

        {/* Preview Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sample Card */}
          <div className="card-luxury p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                {isEn ? 'Specialized Surgery' : 'جراحی و درمان تخصصی'}
              </span>
              <span className="text-xs text-muted-foreground">
                {isEn ? '45 minutes' : '۴۵ دقیقه'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-foreground">
              {isEn ? 'Orthopedic & Joint Consultation' : 'ویزیت تخصصی و ارتوپدی حیوانات'}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isEn
                ? 'Complete clinical assessment, digital diagnostics, and mobility treatments for dogs and cats.'
                : 'معاینه کامل بالینی مفاصل، عکسبرداری دیجیتال و تشخیص دقیق بیماری‌های حرکتی سگ و گربه.'}
            </p>
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <span className="text-sm font-bold text-primary">
                {isEn ? '350,000 Toman' : '۳۵۰,۰۰۰ تومان'}
              </span>
              <Button size="sm" className="bg-gradient-gold text-charcoal-950 font-bold rounded-full text-xs shadow-gold">
                {isEn ? 'Book Visit' : 'رزرو نوبت'}
              </Button>
            </div>
          </div>

          {/* Sample Badges & Controls */}
          <div className="p-6 rounded-xl bg-surface-card border border-border space-y-5">
            <h4 className="text-sm font-bold text-foreground">
              {isEn ? 'Metallic Pill Badges (Brand Identity):' : 'نشان‌های متالیک (برگرفته از نمونه کار):'}
            </h4>
            <div className="flex flex-wrap gap-2">
              <LuxuryPillBadge variant="gold">
                {isEn ? 'Care with Love' : 'مراقبت با عشق'}
              </LuxuryPillBadge>
              <LuxuryPillBadge variant="gold">
                {isEn ? 'Surgery' : 'جراحی'}
              </LuxuryPillBadge>
              <LuxuryPillBadge variant="gold">
                {isEn ? 'Dentistry' : 'دندانپزشکی'}
              </LuxuryPillBadge>
              <LuxuryPillBadge variant="outline">
                {isEn ? 'Luxury Shop' : 'لوازم لوکس'}
              </LuxuryPillBadge>
            </div>

            <h4 className="text-sm font-bold text-foreground pt-2 border-t border-border">
              {isEn ? 'Form Controls & Buttons:' : 'دکمه‌ها و فیلدهای ورودی:'}
            </h4>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                readOnly
                value={isEn ? 'Sample text input field' : 'نمونه فیلد ورودی متن'}
                className="px-3.5 py-2 text-xs rounded-lg border border-border bg-surface text-foreground outline-none flex-1"
              />
              <Button size="sm" variant="outline" className="border-border-gold text-foreground hover:bg-surface-elevated text-xs">
                {isEn ? 'Secondary Button' : 'دکمه ثانویه'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
