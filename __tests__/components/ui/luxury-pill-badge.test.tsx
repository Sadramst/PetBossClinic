import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LuxuryPillBadge } from '@/components/ui/luxury-pill-badge';

describe('LuxuryPillBadge Component', () => {
  it('renders Persian pill badge text matching physical branding', () => {
    render(<LuxuryPillBadge variant="gold">مراقبت با عشق</LuxuryPillBadge>);
    expect(screen.getByText('مراقبت با عشق')).toBeDefined();
  });

  it('applies the signature gold badge class by default', () => {
    const { container } = render(<LuxuryPillBadge>جراحی تخصصی</LuxuryPillBadge>);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('badge-pill-gold');
  });

  it('applies outline variant correctly', () => {
    const { container } = render(
      <LuxuryPillBadge variant="outline">لوازم لوکس</LuxuryPillBadge>
    );
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('badge-pill-outline');
  });

  it('renders with custom icon', () => {
    render(
      <LuxuryPillBadge icon={<span data-testid="pill-icon">🐾</span>}>
        دندانپزشکی
      </LuxuryPillBadge>
    );
    expect(screen.getByTestId('pill-icon')).toBeDefined();
    expect(screen.getByText('دندانپزشکی')).toBeDefined();
  });
});
