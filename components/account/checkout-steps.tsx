import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const STEPS: { label: string; href?: string }[] = [
  { label: 'سبد خرید', href: '/cart' },
  { label: 'نشانی و پرداخت', href: '/checkout' },
  { label: 'ثبت سفارش' },
];

/** Progress indicator shared by the cart, checkout and order-placed pages. */
export function CheckoutSteps({ current, className }: { current: 1 | 2 | 3; className?: string }) {
  return (
    <nav aria-label="مراحل خرید" className={cn('iran-checkout-steps print:hidden', className)}>
      <ol className="mx-auto grid max-w-xl grid-cols-3">
        {STEPS.map((step, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          const circle = (
            <span
              className={cn(
                'relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-extrabold transition-colors',
                done && 'border-primary bg-primary text-charcoal-950',
                active && 'border-primary bg-surface text-primary shadow-gold',
                !done && !active && 'border-border bg-surface text-muted-foreground'
              )}
            >
              {done ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m5 12 5 5 9-10" />
                </svg>
              ) : (
                n.toLocaleString('fa-IR')
              )}
            </span>
          );
          const label = (
            <span
              className={cn(
                'mt-2 block text-[11px] leading-5 sm:text-sm',
                active ? 'font-extrabold text-foreground' : done ? 'font-bold text-primary' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
          );
          return (
            <li key={step.label} aria-current={active ? 'step' : undefined} className="relative flex flex-col items-center text-center">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn('absolute end-1/2 top-[1.0625rem] h-0.5 w-full', n <= current ? 'bg-primary' : 'bg-border')}
                />
              )}
              {done && step.href ? (
                <Link href={step.href} className="flex flex-col items-center rounded-lg hover:opacity-85" aria-label={`بازگشت به ${step.label}`}>
                  {circle}
                  {label}
                </Link>
              ) : (
                <>
                  {circle}
                  {label}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
