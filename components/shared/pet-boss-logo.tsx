'use client';

import React from 'react';
import { useLocale } from 'next-intl';

interface PetBossLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textColor?: string;
  variant?: 'gold' | 'white' | 'dark';
  subtitle?: string;
}

export function PetBossLogo({
  className = '',
  size = 'md',
  showText = true,
  variant = 'gold',
  subtitle,
}: PetBossLogoProps) {
  let locale = 'fa';
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    locale = useLocale();
  } catch {
    locale = 'fa';
  }

  const isEn = locale === 'en';

  const sizeMap = {
    sm: { icon: 32, title: 'text-sm', sub: 'text-[9px]' },
    md: { icon: 44, title: 'text-lg', sub: 'text-[11px]' },
    lg: { icon: 72, title: 'text-2xl', sub: 'text-xs' },
    xl: { icon: 110, title: 'text-4xl', sub: 'text-sm' },
  };

  const currentSize = sizeMap[size];


  const defaultSubtitle = subtitle || (isEn ? 'CLINIC & PET SHOP' : 'کلینیک و پت شاپ');

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Crowned Lion & Animals Authentic Emblem from Logo.jpg */}
      <svg
        width={currentSize.icon}
        height={currentSize.icon}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-105 drop-shadow-[0_4px_12px_rgba(197,160,89,0.35)]"
        aria-label="Pet Boss Clinic Logo"
      >
        <defs>
          <linearGradient id="lionGoldGrad" x1="15%" y1="10%" x2="85%" y2="90%">
            <stop offset="0%" stopColor="#FFF2D1" />
            <stop offset="25%" stopColor="#E5C158" />
            <stop offset="55%" stopColor="#C5A059" />
            <stop offset="85%" stopColor="#9C7730" />
            <stop offset="100%" stopColor="#755217" />
          </linearGradient>

          <filter id="goldGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#C5A059" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Authentic Brand Emblem Image (white background removed) */}
        <image
          href="/images/logo.png"
          x="0"
          y="0"
          width="120"
          height="120"
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>

      {/* Typography with Golden Foil Gradient */}
      {showText && (
        <div className="flex flex-col">
          <span
            className={`font-black tracking-[0.25em] leading-none ${currentSize.title} ${
              variant === 'gold' ? 'text-gradient-gold font-sans' : 'text-foreground'
            } uppercase`}
          >
            PET BOSS
          </span>
          <span
            className={`font-semibold tracking-wider mt-1 text-primary/80 ${currentSize.sub}`}
          >
            {defaultSubtitle}
          </span>
        </div>
      )}
    </div>
  );
}
