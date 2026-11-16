import type { Metadata } from 'next';

// Cart, checkout and customer account pages are private: never index them.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AccountGroupLayout({ children }: { children: React.ReactNode }) {
  return <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-10">{children}</div>;
}
