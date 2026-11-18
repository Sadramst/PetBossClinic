import type { ReactNode, SVGProps } from 'react';

/** Line icons for the homepage (stroke follows currentColor, so they stay on-brand). */
function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const ShieldCheckIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5.5c0 4.4 2.9 8.2 7 9.5 4.1-1.3 7-5.1 7-9.5V6l-7-3z" />
    <path d="m9 12 2.2 2.2L15.2 10" />
  </Icon>
);

export const CalendarCheckIcon = (p: P) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4" />
  </Icon>
);

export const StethoscopeIcon = (p: P) => (
  <Icon {...p}>
    <path d="M6 3v6a4 4 0 0 0 8 0V3M6 3H4.5M14 3h1.5M10 13v2.5a4.5 4.5 0 0 0 9 0V13" />
    <circle cx="19" cy="11" r="2" />
  </Icon>
);

export const TruckIcon = (p: P) => (
  <Icon {...p}>
    <path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3.5v3h-7" />
    <circle cx="7" cy="17.5" r="2" />
    <circle cx="17" cy="17.5" r="2" />
  </Icon>
);

export const PhoneIcon = (p: P) => (
  <Icon {...p}>
    <path d="M5 4h3.5l1.5 4.5-2 1.5a12 12 0 0 0 6 6l1.5-2 4.5 1.5V19a2 2 0 0 1-2 2C10.5 21 3 13.5 3 6a2 2 0 0 1 2-2z" />
  </Icon>
);

export const MapPinIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Icon>
);

export const ClockIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const CheckIcon = (p: P) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const ChevronDownIcon = (p: P) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

/** Points toward the inline end in RTL (left); flipped for LTR. */
export const ArrowForwardIcon = ({ className = '', ...p }: P) => (
  <Icon className={`ltr:rotate-180 ${className}`} {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);

export const BagIcon = (p: P) => (
  <Icon {...p}>
    <path d="M5 8h14l-1 12.5H6L5 8zM9 8V6.5a3 3 0 0 1 6 0V8" />
  </Icon>
);
