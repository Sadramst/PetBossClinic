interface PetBossLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textColor?: string;
  variant?: 'gold' | 'white' | 'dark';
  subtitle?: string;
  logoUrl?: string;
}

const SIZE_MAP = {
  sm: { icon: 32, title: 'text-sm', sub: 'text-[9px]' },
  md: { icon: 44, title: 'text-lg', sub: 'text-[11px]' },
  lg: { icon: 72, title: 'text-2xl', sub: 'text-xs' },
  xl: { icon: 110, title: 'text-4xl', sub: 'text-sm' },
} as const;

/**
 * Brand lockup: emblem + "PET BOSS" wordmark + Persian subtitle.
 * The emblem is decorative next to the wordmark (the wrapping link's
 * aria-label carries the name). Works in server and client components.
 */
export function PetBossLogo({
  className = '',
  size = 'md',
  showText = true,
  variant = 'gold',
  subtitle = 'کلینیک و پت شاپ',
  logoUrl = '/images/logo.png',
}: PetBossLogoProps) {
  const currentSize = SIZE_MAP[size];

  const effectiveLogoUrl =
    logoUrl && logoUrl !== '/images/logo.png'
      ? logoUrl
      : showText
        ? size === 'sm' || size === 'md'
          ? '/images/logo-64.png'
          : '/images/logo-emblem.png'
        : '/images/logo.png';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        width={currentSize.icon}
        height={currentSize.icon}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-105"
        {...(showText
          ? { 'aria-hidden': true, focusable: false }
          : { role: 'img', 'aria-label': 'نشان پت‌باس' })}
      >
        <image href={effectiveLogoUrl} x="0" y="0" width="120" height="120" preserveAspectRatio="xMidYMid meet" />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <span
            className={`font-black tracking-[0.25em] leading-none ${currentSize.title} ${
              variant === 'gold' ? 'text-gradient-gold font-sans' : 'text-foreground'
            } uppercase`}
          >
            PET BOSS
          </span>
          <span className={`mt-1 font-semibold tracking-wider text-primary/80 ${currentSize.sub}`}>{subtitle}</span>
        </div>
      )}
    </div>
  );
}
