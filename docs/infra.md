# Infrastructure (what is deployed)

## Verified from the repo
- Hosting: Vercel, region `fra1`, deploys `main`. Node `^20.17 || >=22`.
- Build: `npm run build` = `prisma generate && node scripts/release-db.mjs && next build`.
- Crons (`vercel.json`, Hobby plan allows daily only): `/api/cron/expiry` at 21:30 and `/api/cron/club` at 06:05. Both expect `Authorization: Bearer CRON_SECRET`.
- Media: PostgreSQL `Media` table, served by `/api/media/[key]`.
- CI: `.github/workflows/{ci,e2e,lighthouse,db-migrate,deploy}.yml`.
- `infra/docker-compose.yml`: local db and pgbouncer for dev or self-hosting.

## Environment variables
| Group | Variables |
|---|---|
| Core | `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (`NEXTAUTH_SECRET` fallback), `AUTH_URL`, `CRON_SECRET`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` |
| SMS | `SMS_PROVIDER` (kavenegar, smsir, console), `KAVENEGAR_API_KEY`, `KAVENEGAR_OTP_TEMPLATE`, `KAVENEGAR_SENDER`, `SMSIR_API_KEY`, `SMSIR_OTP_TEMPLATE_ID`, `SMSIR_LINE_NUMBER`, `SMS_INBOUND_SECRET` |
| Payment, shipping | `ZARINPAL_MERCHANT_ID`, `ZARINPAL_SANDBOX`, `SHIPPING_TEHRAN_FEE`, `SHIPPING_POST_FEE`, `SHIPPING_FREE_OVER`, `SHIPPING_COURIER_CITIES` |
| Optional | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `MIN_SHELF_LIFE_DAYS`, `E2E_PORT` |

`.env.example` still says the club cron is hourly; it is daily.

## Unverified: confirm with the owner
- Production Postgres host and provider. Record host, owner and backup schedule in private ops notes, not in this repo.
- Backups: `infra/backup.sh` is a local `pg_dump` with no compression, rotation or upload. Treat production backups as unverified until a provider snapshot or offsite job and a restore test exist.
- `STORAGE_*` variables exist in `.env.example`; their use is unverified.
- Database exposure: Vercel has no static egress IPs, so an IP allow-list does not work. Require TLS and strong passwords, or use managed or private-network Postgres.
