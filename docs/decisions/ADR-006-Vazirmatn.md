# ADR 006: Typography Selection — Vazirmatn Variable Font for Persian & Outfit for English

- **Status:** Accepted
- **Deciders:** Product Strategy Manager, Lead UX Designer
- **Date:** 2026-09-04

---

## Context
Pet Boss Clinic targets high-net-worth pet owners in affluent districts of northern Tehran (Gheitariyeh, Elahieh, Farmanieh). The typography must evoke luxury, trust, medical professionalism, and readability across varied mobile screen resolutions.

Key constraints:
- Must have native support for Persian glyphs, dots, zero-width non-joiners (ZWNJ / نیم‌فاصله), and Persian numerals.
- Variable font format to minimize HTTP payload size by bundling multiple weights (100 to 900) into a single optimized woff2 file.
- Clean English pairing that matches the geometric, modern luxury tone of the brand.

## Decision
We standardized on:
1. **Primary Persian Font:** **Vazirmatn** variable font (`next/font/google`), loaded globally for the Persian locale (`/`, `dir="rtl"`).
2. **Primary English Font:** **Outfit** variable font (`next/font/google`), loaded for English routes (`/en`, `dir="ltr"`).

## Consequences
### Positive
- **Visual Elegance:** Vazirmatn's proportions and calligraphic balance create an uncluttered, premium reading experience on Retina/OLED mobile displays.
- **Subsetting & Performance:** Next.js font optimization automatically subsets Persian glyphs, reducing font download payloads by up to 60%.
- **Zero Layout Shift (CLS):** Preloaded variable fonts prevent flash of unstyled text (FOUT) and eliminate layout reflows during page load.
- **RTL Number Formatting:** Seamlessly renders Persian numerals alongside Latin technical specifications and medical terms.

### Negative / Trade-offs
- Font switching between locales requires dynamic body class injection (`vazirmatn.className` on `/`, `outfit.className` on `/en`) in `app/[locale]/layout.tsx`.

## Alternatives Considered
- **IranSans / Shabnam:** High licensing costs for commercial multi-domain web use with complex font-family hosting requirements.
- **System Fonts (`Tahoma`, `Arial`):** Generic, dated appearance completely incompatible with luxury pet clinic branding.
