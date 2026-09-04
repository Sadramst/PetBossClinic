# Theming & Visual Brand Identity

This document details the brand design tokens, theme engine architecture, luxury color palettes, and dynamic theme switching capabilities for **Pet Boss Clinic (پت‌باس)**.

---

## 1. Brand Inspiration & Identity (`petbossclinic.jpeg`)

The visual design is grounded in the physical brand mockup (`RelatedPhotos/petbossclinic.jpeg`):
- **Core Aesthetic**: High-end luxury veterinary clinic and bespoke pet boutique.
- **Base Surfaces**: Deep matte charcoal slate (`#181A20`, `#222630`, `#272C38`), providing a calm, premium, clinic-grade visual foundation.
- **Metallic Gold Accents**: Polished brass and champagne gold (`#C5A059`, `#D4AF37`, `#E5C06E`) with warm ambient gradients and subtle shadows.
- **Signature Physical Elements**:
  - **Crowned Lion Emblem**: Vector SVG (`<PetBossLogo />`) featuring a lion head with internal animal silhouettes (cat and dog), topped with a 5-point jewel crown.
  - **Golden Pill Badges**: Raised metallic pills (`<LuxuryPillBadge />`) displaying core specialties directly from the physical collateral: `مراقبت با عشق`, `جراحی تخصصی`, `دندانپزشکی`, `بیماری‌های داخلی`, `بستری و پانسیون`, `لوازم لوکس`.

---

## 2. Design Tokens Architecture (`styles/tokens.css`)

Tokens are declared as CSS custom properties on `:root` and selected via the `[data-theme="..."]` attribute on the `<html>` root.

```css
:root,
[data-theme="petboss-luxury-dark"] {
  --background: #181a20;
  --foreground: #f6f6f8;
  --surface: #1e2229;
  --surface-card: #23272f;
  --surface-elevated: #2b303b;
  --surface-hover: #323846;

  --primary: #c5a059;
  --primary-foreground: #181a20;
  --primary-hover: #d4ab44;

  --secondary: #2b303b;
  --secondary-foreground: #f6f6f8;

  --border: #2e3442;
  --border-gold: rgba(197, 160, 89, 0.35);
  --border-gold-glow: rgba(212, 175, 55, 0.6);
  --ring: #c5a059;

  --shadow-gold: 0 4px 20px rgba(197, 160, 89, 0.28);
  --shadow-gold-lg: 0 10px 30px rgba(197, 160, 89, 0.42);
}
```

---

## 3. Theme Presets

| Preset ID | Name (FA) | Description | Primary Accent | Background |
|---|---|---|---|---|
| `petboss-luxury-dark` | **لوکس مشکی و طلایی (اصلی)** | Default signature theme matching `petbossclinic.jpeg` | `#C5A059` | `#181A20` |
| `petboss-luxury-light` | **لوکس روشن کرم و طلایی** | Opulent light theme with silk cream and polished gold | `#B58D3C` | `#FBF9F5` |
| `emerald-prestige` | **سبز زمردی اشرافی و طلا** | Deep forest hunter emerald accented with warm gold | `#D4AB44` | `#0C1813` |
| `royal-obsidian` | **آبسیدین سیاه شب و شامپاین** | Ultra-dark obsidian black with champagne gold touches | `#E5C06E` | `#0D0E10` |

---

## 4. Dynamic Theme Switching Engine

### 4.1 Server-Side Zero-FOUC Injection
In `app/[locale]/layout.tsx`, the server component inspects incoming request cookies:
```tsx
const cookieStore = await cookies();
const rawTheme = cookieStore.get('petboss_theme')?.value as ThemePreset | undefined;
const initialTheme: ThemePreset = rawTheme || 'petboss-luxury-dark';

return (
  <html lang={locale} dir={dir} data-theme={initialTheme} suppressHydrationWarning>
    <ThemeProvider initialTheme={initialTheme}>
      {children}
    </ThemeProvider>
  </html>
);
```

### 4.2 Client React Context (`lib/theme/`)
- `ThemeProvider` manages active state and provides `useTheme()`:
  - `theme`: Currently active preset ID.
  - `setTheme(preset)`: Applies `data-theme` to `document.documentElement`, updates `localStorage`, and sets `petboss_theme` cookie with 1-year max-age.
  - `presets`: List of all available theme definitions.

### 4.3 Admin Interactive Customizer (`/admin/theme`)
Administrators can preview and toggle themes live:
- View color swatches for each palette.
- Inspect real-time rendering of sample cards, pill badges, buttons, and typography.
- Activate the theme with one click.
