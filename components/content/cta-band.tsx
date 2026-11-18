import type { ReactNode } from 'react';
import type { ClinicNAP } from '@/lib/clinic/nap';
import { ChatIcon, PhoneIcon } from './icons';

export interface CtaBandProps {
  title: ReactNode;
  text?: ReactNode;
  nap: Pick<ClinicNAP, 'telLink' | 'phoneDisplayFa' | 'whatsappLink'>;
  callLabel?: string;
  /** Heading level; h2 by default. */
  as?: 'h2' | 'h3';
  /** Extra links (e.g. to the shop) rendered after call / WhatsApp. */
  children?: ReactNode;
  className?: string;
}

/** Closing call-to-action: phone, WhatsApp and optional cross-links. */
export function CtaBand({ title, text, nap, callLabel = 'تماس و رزرو نوبت', as: Heading = 'h2', children, className = '' }: CtaBandProps) {
  return (
    <section
      className={`rounded-3xl border border-border-gold/50 bg-surface-card p-5 shadow-gold sm:p-8 ${className}`}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <Heading className="text-lg font-black sm:text-xl">{title}</Heading>
          {text && <p className="mt-2 text-sm leading-8 text-muted-foreground">{text}</p>}
          <p className="mt-2 text-sm text-muted-foreground">
            تلفن کلینیک:{' '}
            <a href={nap.telLink} dir="ltr" className="inline-block font-bold text-foreground hover:text-primary">
              {nap.phoneDisplayFa}
            </a>
          </p>
        </div>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap lg:shrink-0">
          <a href={nap.telLink} className="btn btn-gold">
            <PhoneIcon className="h-4 w-4" />
            {callLabel}
          </a>
          {nap.whatsappLink && (
            <a href={nap.whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              <ChatIcon className="h-4 w-4" />
              پیام در واتس‌اپ
            </a>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
