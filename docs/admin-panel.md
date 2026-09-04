# Admin Panel Specification (`/admin`)

This document specifies the architecture, feature modules, operational workflows, and security design of the custom **Pet Boss Admin Back Office**.

---

## 1. Overview & Prototype Status

> [!IMPORTANT]
> The admin panel is currently operating as an **interactive working prototype**. It is wired to PostgreSQL 16 via Prisma ORM, rendering live statistics, leads, and services from the database. It allows visual testing and administrative validation before full authentication hardening in Phase 2.

The admin panel is built inside the same Next.js App Router application under `app/[locale]/admin`, ensuring:
- Single unified design system and shared TypeScript types.
- Zero reliance on external, third-party headless CMS services.
- Server-rendered performance with Server Actions for mutations.
- Full RTL and LTR support with Persian calendar integration.

---

## 2. Admin Modules Breakdown

### 2.1 Dashboard (`/admin`)
- **Key Metrics Grid**: Real-time counts of active services, veterinary staff, FAQs, reviews, customer leads, and inbox messages.
- **Recent Leads**: Recent appointment/consultation requests with applicant phone, status, and timestamp.
- **Recent Messages**: Incoming contact form submissions with unread indicators.
- **Quick Action Bar**: Instant link to the Dynamic Theme Customizer.

### 2.2 Theme Manager (`/admin/theme`)
- **Preset Palettes**:
  1. *Pet Boss Luxury Dark (Signature)*: Charcoal slate `#181A20` & Metallic Gold `#C5A059` (Default).
  2. *Pet Boss Luxury Light*: Silk Cream `#FBF9F5` & Metallic Gold `#B58D3C`.
  3. *Emerald Prestige*: Hunter Emerald `#0C1813` & Gold `#D4AB44`.
  4. *Royal Obsidian*: Obsidian Black `#0D0E10` & Champagne Gold `#E5C06E`.
- **Live Interactive Preview**: Real-time rendering of a sample luxury card, golden pill badge, buttons, and form inputs as you toggle themes.
- **Persistence**: Instant activation across the entire site via a 1-year `petboss_theme` cookie.

### 2.3 Services Management (`/admin/services`)
- Full data table displaying service title (Persian/English), top-level division, duration, base price in Toman, and active/inactive status toggle.
- Add / Edit service modal with price note options («تماس بگیرید»).

### 2.4 Divisions Management (`/admin/divisions`)
- Oversees the 3 core clinic divisions:
  1. **بخش درمانی، داخلی و جراحی** (Clinical / Internal Medicine & Surgery)
  2. **بخش آرایش، شستوشو و بهداشت** (Grooming & Hygiene)
  3. **پت‌شاپ** (Pet Shop)
- Service counters and active status management per division.

### 2.5 Staff & Doctors Management (`/admin/staff`)
- Profiles of veterinarians and medical staff.
- Fields: Full name (FA/EN), medical title, veterinary specialty, and Veterinary Medical Council License Number (شماره نظام دامپزشکی).

### 2.6 Pet Shop Products (`/admin/products`)
- Catalog items for dog/cat food, treats, hygiene, and accessories.
- Fields: SKU, category, price in Toman, stock status (`OUT_OF_STOCK`, `IN_STOCK`, `PREORDER`).
- Phase 1 operation: All products display prices with «بهزودی» / «تماس بگیرید» (no direct online checkout).

### 2.7 Leads & Appointments (`/admin/leads`)
- Captures appointment inquiries submitted through marketing forms.
- Fields: Applicant name, phone number (E.164), requested pet type, message, status (`NEW`, `CONTACTED`, `BOOKED`), and submission date.

### 2.8 Contact Messages Inbox (`/admin/messages`)
- Inquiries submitted through `/contact`.
- Status indicators: Unread (emerald glowing badge) vs Read.

### 2.9 FAQs Repository (`/admin/faqs`)
- Categorized FAQ management for clinic procedures, vaccination ages, and working hours.

### 2.10 Site & Clinic Settings (`/admin/settings`)
- Clinic name (FA/EN), brand tagline («مراقبت با عشق»), emergency contact number (`۰۲۱-۲۲۰۰۰۰۰۰`), physical address, daily working hours (`۱۰:۰۰ الی ۲۲:۰۰`), and exact GPS coordinates (`35.790937, 51.4350853`).

---

## 3. Next Steps for Production Hardening

1. **Authentication & RBAC**:
   - Integrate NextAuth v5 with credentials provider.
   - Roles: `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `AUTHOR`, `VIEWER`.
   - Implement TOTP two-factor authentication (Google Authenticator / 1Password).
2. **Media Library (`/admin/media`)**:
   - S3-compatible file upload to Vultr Object Storage with `sharp` WebP/AVIF resizing.
   - Mandatory bilingual alt text (`altFa`, `altEn`) for SEO compliance.
3. **Audit Logging**:
   - Automatic recording of admin mutations (who, what, entity ID, diff, IP) into the `AuditLog` table.
