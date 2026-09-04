import React from 'react';

interface LuxuryPillBadgeProps {
  children: React.ReactNode;
  variant?: 'gold' | 'outline' | 'glass';
  className?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export function LuxuryPillBadge({
  children,
  variant = 'gold',
  className = '',
  icon,
  onClick,
}: LuxuryPillBadgeProps) {
  const baseClasses =
    variant === 'gold'
      ? 'badge-pill-gold'
      : variant === 'outline'
      ? 'badge-pill-outline'
      : 'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-surface-card/80 text-foreground border border-border-gold backdrop-blur-md hover:border-primary transition-all';

  return (
    <span
      onClick={onClick}
      className={`${baseClasses} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
