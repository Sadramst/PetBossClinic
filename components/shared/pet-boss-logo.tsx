'use client';

import React from 'react';

interface PetBossLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textColor?: string;
  variant?: 'gold' | 'white' | 'dark';
}

export function PetBossLogo({
  className = '',
  size = 'md',
  showText = true,
  variant = 'gold',
}: PetBossLogoProps) {
  const sizeMap = {
    sm: { icon: 28, title: 'text-sm', sub: 'text-[9px]' },
    md: { icon: 40, title: 'text-lg', sub: 'text-[11px]' },
    lg: { icon: 64, title: 'text-2xl', sub: 'text-xs' },
    xl: { icon: 96, title: 'text-4xl', sub: 'text-sm' },
  };

  const currentSize = sizeMap[size];

  const primaryFill =
    variant === 'gold'
      ? 'url(#goldGrad)'
      : variant === 'white'
      ? '#ffffff'
      : '#181a20';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Crowned Lion & Animals SVG Emblem */}
      <svg
        width={currentSize.icon}
        height={currentSize.icon}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-105 drop-shadow-[0_2px_8px_rgba(197,160,89,0.3)]"
      >
        <defs>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f4ecce" />
            <stop offset="35%" stopColor="#dec070" />
            <stop offset="70%" stopColor="#c5a059" />
            <stop offset="100%" stopColor="#936e2b" />
          </linearGradient>
          <linearGradient id="crownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff3d1" />
            <stop offset="50%" stopColor="#d4ab44" />
            <stop offset="100%" stopColor="#876320" />
          </linearGradient>
        </defs>

        {/* Crown on top */}
        <path
          d="M32 24 L38 31 L50 20 L62 31 L68 24 L64 36 L36 36 Z"
          fill="url(#crownGrad)"
          stroke="#dec070"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Crown Jewels */}
        <circle cx="32" cy="22" r="2.2" fill="#fff" />
        <circle cx="50" cy="18" r="2.8" fill="#fff" />
        <circle cx="68" cy="22" r="2.2" fill="#fff" />

        {/* Lion Mane Outer Crest */}
        <path
          d="M50 32
             C35 32 23 44 23 60
             C23 75 33 87 47 92
             C49 92.6 51 92.6 53 92
             C67 87 77 75 77 60
             C77 44 65 32 50 32 Z"
          stroke={primaryFill}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Lion Ears */}
        <path
          d="M28 42 C24 38 23 32 28 30 C33 28 37 34 37 37"
          stroke={primaryFill}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M72 42 C76 38 77 32 72 30 C67 28 63 34 63 37"
          stroke={primaryFill}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Lion Eyes & Brow */}
        <path
          d="M37 50 C41 49 44 51 44 53"
          stroke={primaryFill}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M63 50 C59 49 56 51 56 53"
          stroke={primaryFill}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Center Lion Nose & Animal Silhouettes */}
        <path
          d="M50 54 L46 60 C46 62 54 62 54 60 Z"
          fill={primaryFill}
        />
        <path
          d="M50 62 L50 67 M46 66 C48 68 52 68 54 66"
          stroke={primaryFill}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Cat Silhouette inside left cheek */}
        <path
          d="M35 76 C35 70 38 64 42 66 C44 68 43 75 42 78 Z"
          fill={primaryFill}
          opacity="0.85"
        />
        {/* Dog Silhouette inside right cheek */}
        <path
          d="M65 76 C65 68 61 63 58 66 C56 68 57 75 58 78 Z"
          fill={primaryFill}
          opacity="0.85"
        />
      </svg>

      {/* Typography */}
      {showText && (
        <div className="flex flex-col">
          <span
            className={`font-black tracking-widest leading-none ${currentSize.title} ${
              variant === 'gold' ? 'text-gradient-gold font-sans' : 'text-foreground'
            }`}
          >
            PET BOSS
          </span>
          <span
            className={`font-medium tracking-wide mt-1 text-muted-foreground ${currentSize.sub}`}
          >
            کلینیک و پت شاپ
          </span>
        </div>
      )}
    </div>
  );
}
