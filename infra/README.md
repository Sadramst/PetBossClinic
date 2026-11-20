# infra

Docker Compose for local development or self-hosting: services `db` (PostgreSQL 16) and `pgbouncer` (host port 6432).

1. Create `infra/.env` with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (defaults: user, password, `petboss`).
2. Run `docker compose up -d`.
3. `backup.sh` makes a plain local `pg_dump` from container `infra-db-1`. It has no compression, rotation or upload; use it for dev only.

Production uses whatever `DATABASE_URL` points to; see `docs/infra.md`.
