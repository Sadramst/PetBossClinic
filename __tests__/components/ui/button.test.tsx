/* eslint-disable @next/next/no-html-link-for-pages */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('renders correctly', () => {
    render(<Button>Click Me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeDefined();
  });

  it('applies the default variant classes', () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole('button', { name: /default/i });
    // Vitest jsdom className checks
    expect(button.className).toContain('bg-primary');
  });

  it('applies the destructive variant classes', () => {
    render(<Button variant="destructive">Destructive</Button>);
    const button = screen.getByRole('button', { name: /destructive/i });
    expect(button.className).toContain('bg-destructive');
  });

  it('can be rendered as a child component (asChild)', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: /link button/i });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('/test');
  });
});
