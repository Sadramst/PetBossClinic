import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme, THEME_PRESETS } from '@/lib/theme';

function TestThemeConsumer() {
  const { theme, setTheme, presets } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="preset-count">{presets.length}</span>
      <button
        data-testid="switch-to-light"
        onClick={() => setTheme('petboss-luxury-light')}
      >
        Light
      </button>
      <button
        data-testid="switch-to-emerald"
        onClick={() => setTheme('emerald-prestige')}
      >
        Emerald
      </button>
    </div>
  );
}

describe('Dynamic Theme Engine', () => {
  it('loads signature Pet Boss Luxury Dark theme as default', () => {
    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme').textContent).toBe('petboss-luxury-dark');
    expect(screen.getByTestId('preset-count').textContent).toBe('4');
  });

  it('switches theme dynamically when setTheme is called', () => {
    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    );

    const lightBtn = screen.getByTestId('switch-to-light');
    fireEvent.click(lightBtn);
    expect(screen.getByTestId('current-theme').textContent).toBe('petboss-luxury-light');

    const emeraldBtn = screen.getByTestId('switch-to-emerald');
    fireEvent.click(emeraldBtn);
    expect(screen.getByTestId('current-theme').textContent).toBe('emerald-prestige');
  });

  it('defines all 4 required theme presets with valid color definitions', () => {
    expect(THEME_PRESETS).toHaveLength(4);
    for (const preset of THEME_PRESETS) {
      expect(preset.primaryColor).toMatch(/^#/);
      expect(preset.bgColor).toMatch(/^#/);
      expect(preset.nameFa).toBeDefined();
    }
  });
});
