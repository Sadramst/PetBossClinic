# Pet Boss Clinic: Product Vision

Status: approved for R1 build. Owner: product owner (clinic owner). Product UI language: Persian (Farsi, RTL, Jalali dates, Toman).

## 1. Vision
Pet Boss Clinic is one site that runs an Iranian veterinary clinic and its online pet shop. The public site sells and builds trust. Behind it, a full CRM gives every person who touches the business (visitor, lead, customer, pet owner) one identity, one timeline, one owner and a next action. Staff work from a queue instead of memory.

> Every enquiry gets an owner and a next step; every customer is known by their pets; nothing expires on the shelf unnoticed.

## 2. Problems today
- Four identity silos (Lead, ContactMessage, MarketingContact, NewsletterSubscriber). A lead who orders stays NEW forever.
- No tasks, no ownership, no unified timeline, no appointments UI, no ticket replies.
- Expiry is handled on one admin page far from the product; the storefront shows the date twice with weak hierarchy; near-expiry stock cannot be discounted.
- Admin sidebar of 32 items, inconsistent list pages, native confirm dialogs, silent truncation at 50-200 rows.
- Docs described a Phase-1 bilingual prototype that no longer exists.

## 3. Personas
| Persona | Goal | Key screens |
|---|---|---|
| Owner (مدیر کلینیک) | See money, risk and team load at a glance; control access | Dashboard, reports, users, expiry report |
| Receptionist (پذیرش) | Answer calls, book visits, never lose a lead | Tasks, leads, appointments, inbox, customer 360 |
| Vet (دامپزشک) | See the pet history, record visits and vaccines | Customer 360, pet records, visits |
| Shop operator (مسئول فروشگاه) | Fulfil orders, keep stock correct and fresh | Orders, products, inventory/expiry |
| Marketer (بازاریاب) | Reach the right people, with consent, and measure it | Segments, campaigns, automations, coupons, reports |
| Customer (مشتری) | Buy confidently, keep pet records, earn rewards, get answers | Shop, account, club, booking, tickets |

## 4. Principles
1. One person, one identity: resolve by normalised mobile number.
2. Extend, do not rewrite: additive schema, existing pages keep working.
3. Queue over dashboard: every screen answers "what do I do next?".
4. Consent first: no marketing SMS without recorded consent; STOP is honoured everywhere.
5. Honest shelf life: customers see the date that will ship; staff see risk early.
6. Fast at 700+ products and growing: server-side pagination, no unbounded `findMany`.
7. Persian-native: RTL logical properties, Jalali, Persian digits, Toman, human copy.
8. Everything audited: admin writes go through `requireAdmin` + `logAdminChange` + zod.

## 5. Success metrics (90 days after R1)
| Metric | Target |
|---|---|
| Leads with an owner within 1 hour (working hours) | 95% |
| Median lead first-contact time | under 2 hours |
| Overdue tasks at end of day | under 5% of open |
| Leads resolved to a Customer automatically (phone match) | 100% |
| Expired stock units shipped | 0 |
| Value written off as expired | down 50% vs prior quarter |
| Admin list page p95 server time | under 400 ms |
| Repeat purchase rate (60 days) | up 10% relative |
| Ticket first response | under 4 working hours |
