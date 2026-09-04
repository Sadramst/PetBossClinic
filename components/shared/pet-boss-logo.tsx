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

  const primaryFill =
    variant === 'gold'
      ? 'url(#lionGoldGrad)'
      : variant === 'white'
      ? '#ffffff'
      : '#181a20';

  const defaultSubtitle = subtitle || (isEn ? 'CLINIC & PET SHOP' : 'کلینیک و پت شاپ');

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Crowned Lion & Animals SVG Emblem (Faithful to physical branding in petbossclinic.jpeg) */}
      <svg
        width={currentSize.icon}
        height={currentSize.icon}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-105 drop-shadow-[0_4px_12px_rgba(197,160,89,0.35)]"
      >
        <defs>
          {/* Rich Metallic 3D Gold Gradient for Lion Head */}
          <linearGradient id="lionGoldGrad" x1="15%" y1="10%" x2="85%" y2="90%">
            <stop offset="0%" stopColor="#FFF2D1" />
            <stop offset="25%" stopColor="#E5C158" />
            <stop offset="55%" stopColor="#C5A059" />
            <stop offset="85%" stopColor="#9C7730" />
            <stop offset="100%" stopColor="#755217" />
          </linearGradient>

          {/* Glowing Crown Gradient */}
          <linearGradient id="crownGoldGrad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="20%" stopColor="#FFEAA7" />
            <stop offset="60%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#8C6718" />
          </linearGradient>

          <filter id="goldGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#C5A059" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* ═══ 5-POINT ROYAL CROWN ATOP LION HEAD ═══ */}
        <g filter="url(#goldGlow)">
          <path
            d="M38 27 L44 33 L52 23 L60 17 L68 23 L76 33 L82 27 L78 38 L42 38 Z"
            fill="url(#crownGoldGrad)"
            stroke="#C5A059"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* Crown Jewels (5 pearls at points) */}
          <circle cx="38" cy="25" r="2" fill="#FFFFFF" />
          <circle cx="52" cy="21" r="2.2" fill="#FFFFFF" />
          <circle cx="60" cy="15" r="2.6" fill="#FFFFFF" />
          <circle cx="68" cy="21" r="2.2" fill="#FFFFFF" />
          <circle cx="82" cy="25" r="2" fill="#FFFFFF" />
        </g>

        {/* ═══ MAJESTIC LION HEAD CREST (OUTER SILHOUETTE) ═══ */}
        {/* Rounded Lion Ears */}
        <path
          d="M34 45 C28 40 27 33 33 30 C39 27 45 34 45 38"
          stroke={primaryFill}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M86 45 C92 40 93 33 87 30 C81 27 75 34 75 38"
          stroke={primaryFill}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Outer Mane Crest */}
        <path
          d="M60 36
             C42 36 29 48 29 66
             C29 82 40 98 58 104
             C59.3 104.4 60.7 104.4 62 104
             C80 98 91 82 91 66
             C91 48 78 36 60 36 Z"
          stroke={primaryFill}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* ═══ LION FACIAL FEATURES ═══ */}
        {/* Almond Eyes & Majestic Brow */}
        <path
          d="M45 54 C48 52 52 54 53 57"
          stroke={primaryFill}
          strokeWidth="2.75"
          strokeLinecap="round"
        />
        <path
          d="M75 54 C72 52 68 54 67 57"
          stroke={primaryFill}
          strokeWidth="2.75"
          strokeLinecap="round"
        />

        {/* Nose & Muzzle */}
        <path
          d="M60 59 L55 66 C55 68 65 68 65 66 Z"
          fill={primaryFill}
        />
        <path
          d="M60 67 L60 74 M55 73 C57 75.5 63 75.5 65 73"
          stroke={primaryFill}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* ═══ INNER EMBEDDED PET SILHOUETTES (CAT & DOG IN MANE) ═══ */}
        {/* Left Side: Cat Silhouette Looking Left */}
        <path
          d="M41 86 C41 77 44 71 49 73 C52 74 51 83 49 88 C46 90 42 89 41 86 Z"
          fill={primaryFill}
          opacity="0.9"
        />
        {/* Cat Left Ear */}
        <path
          d="M43 73 L46 67 L49 73 Z"
          fill={primaryFill}
          opacity="0.9"
        />

        {/* Right Side: Dog Silhouette with Floppy Ear Looking Right */}
        <path
          d="M79 86 C79 76 75 70 71 73 C68 74 69 83 71 88 C74 90 78 89 79 86 Z"
          fill={primaryFill}
          opacity="0.9"
        />
        {/* Dog Floppy Ear Drooping Right */}
        <path
          d="M76 71 C79 71 82 74 81 79 C80 82 78 81 77 78 Z"
          fill={primaryFill}
          opacity="0.9"
        />

        {/* Center Lower: Sitting Kitten Silhouette */}
        <path
          d="M56 89 C56 83 58 80 60 80 C62 80 64 83 64 89 C64 96 56 96 56 89 Z"
          fill={primaryFill}
          opacity="0.85"
        />
        {/* Kitten Ears */}
        <path d="M57 80 L58 77 L60 80 Z M60 80 L62 77 L63 80 Z" fill={primaryFill} opacity="0.85" />
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
