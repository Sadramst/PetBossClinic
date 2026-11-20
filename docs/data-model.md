# Data Model

`prisma/schema.prisma` (about 2100 lines, about 100 models). Farsi only; `nameEn` and `slugEn` columns are legacy. Latest migration: `20261123_crm_v2` (see ADR-015).

## Domains
| Domain | Models |
|---|---|
| Identity and admin | User, Account, Session, Permission, RolePermission, TwoFactorToken (schema only, no admin TOTP), AuditLog, LoginAttempt |
| Site and CMS | SiteSetting, SocialLink, ContactChannel, NavigationMenu, MenuItem, Redirect, SeoSetting, AnalyticsSetting, MaintenanceMode, Announcement, Theme, ThemePreset, FontSetting, UserThemePreference, Banner, HomepageSection, Page, LandingPage (no public route), Testimonial, Gallery*, Faq*, Post*, Media* |
| Clinic | Division, ServiceCategory, Service, StaffMember, Specialty, WorkingHour, Certificate, Facility, Species, Breed |
| Catalogue | ProductCategory, Brand, Product, ProductImage, ProductVariant, ProductAttribute, Inventory (batches with expiry), InventoryAdjustment, ExpiryConfig |
| Orders | Customer, OtpCode, Address, Order, OrderItem, Payment, Wishlist, CartSnapshot (no Cart model; the cart is client-side) |
| Club | Pet, PetRecord, ServiceVisit, PointsTransaction, LoyaltyConfig, Reward, RewardRedemption, Segment |
| Marketing | Coupon, CouponRedemption, CustomerGroup and members, MarketingContact, MarketingConfig, MessageCampaign, MessageOutbox, AutomationRule, NewsletterSubscriber |
| CRM (R1) | Contact (identity), Lead (stage, owner, follow-up), ContactMessage (ticket: status, priority, SLA), TicketReply, CrmTask, CrmActivity, SavedView, HealthSnapshot, StaffNotification, AdminCustomerNote |
| Legacy stubs | AppointmentRequest, AppointmentSlot (R2), PetOwner, LegacyPet, MedicalRecord, VaccinationRecord (drop after checking production row counts) |

## Key relations
Customer has many Order, Pet, Address, PointsTransaction. Contact has many Lead and ContactMessage and links to a Customer. `mergedIntoId` on Customer and Contact points to the survivor of a merge. Order has many OrderItem with batch allocations. Product has many Inventory batches with `expiryDate`.

## Invariants
- Points: balance and lifetime points equal the ledger sum; ledger rows are unique per `(kind, refId)`; a merge rebuilds the balance.
- A coupon redemption is counted once per order; cancelling an order returns stock to its batches.
- Stock allocation is FEFO and skips batches inside the minimum shelf life.
- Phones are stored normalised (`09xxxxxxxxx`); one Contact per normalised phone.
- Activity rows are unique per `(type, refType, refId)`.

## Migrations policy
Additive, idempotent SQL in `prisma/migrations/<date>_<name>/`; keep `schema.prisma` in sync by hand; applied in production by `scripts/release-db.mjs`; `scripts/backfill-crm.ts` fills CRM data. Never drop a column in the release that stops using it.

## Seed
`npm run db:seed` hard-codes sample content and runs `deleteMany` on several tables. Dev only, never on production. Real catalogue: `scripts/import-october-inventory.js` then `scripts/assign-brands.ts --apply`.
