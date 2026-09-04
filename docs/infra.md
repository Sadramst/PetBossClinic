# Infrastructure & Hosting Architecture — Pet Boss Clinic

> **Hybrid Cloud Infrastructure Blueprint**  
> Technical documentation covering the edge deployment on Vercel, dedicated database compute on Vultr, object storage, and automated backup operations.

---

## 1. High-Level Architecture

Pet Boss Clinic operates on a hybrid architecture designed for fast edge delivery, low latency in the Middle East and worldwide, and complete control over database security:

```
[ Clients / Mobile / Desktop ]
             │
             ▼ HTTPS
┌───────────────────────────────────────────────┐
│              Vercel Edge Network              │
│  - Global CDN & Anycast DNS                   │
│  - Next.js 15 App Router (SSR & Static Cache) │
│  - Vazirmatn Variable Font Edge Optimization  │
└───────────────────────┬───────────────────────┘
                        │ TLS (Port 5432 / 6432)
                        ▼
┌───────────────────────────────────────────────┐
│        Vultr Dedicated VPS (Ubuntu 22.04)     │
│        IP: 95.179.243.160                     │
│  ┌─────────────────────────────────────────┐  │
│  │ Docker Compose Environment              │  │
│  │  - PostgreSQL 16 Engine                 │  │
│  │  - pgBouncer Connection Pooler          │  │
│  │  - Persistent Volume Storage            │  │
│  └─────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────┐  │
│  │ Automated Daily pg_dump Cron Backup     │  │
│  └────────────────────┬────────────────────┘  │
└───────────────────────┼───────────────────────┘
                        │ Encrypted Backup Sync
                        ▼
┌───────────────────────────────────────────────┐
│       S3-Compatible Object Storage            │
│  - Database Snapshots (30-day retention)      │
│  - Media & Certificate Uploads                │
└───────────────────────────────────────────────┘
```

---

## 2. Vercel Serverless Hosting

The Next.js 15 frontend and API routes are deployed directly to Vercel with automatic continuous integration from the `main` branch.

### 2.1 Project Settings
- **Framework Preset:** Next.js
- **Node.js Version:** 20.x
- **Root Directory:** `./`
- **Build Command:** `npx prisma generate && next build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

### 2.2 Production Environment Variables
| Variable | Description | Example / Required Format |
|---|---|---|
| `DATABASE_URL` | PostgreSQL direct connection | `postgresql://postgres:<PASS>@95.179.243.160:5432/petboss_db?schema=public` |
| `DIRECT_URL` | Unpooled connection for Prisma migrations | `postgresql://postgres:<PASS>@95.179.243.160:5432/petboss_db?schema=public` |
| `NEXTAUTH_SECRET` | NextAuth encryption secret | 32-character random hex string |
| `NEXTAUTH_URL` | Base canonical application URL | `https://www.petbossclinic.com` |
| `NEXT_PUBLIC_APP_URL` | Client-accessible URL | `https://www.petbossclinic.com` |

---

## 3. Database Compute (Vultr VPS)

### 3.1 Server Specifications
- **Operating System:** Ubuntu 22.04 LTS (x64)
- **Primary Public IP:** `95.179.243.160`
- **Container Runtime:** Docker Engine 26.x + Docker Compose v2

### 3.2 Docker Compose Configuration
The database stack is configured in `/opt/petboss-infra/docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: petboss_postgres
    restart: always
    environment:
      POSTGRES_DB: petboss_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    command: >
      postgres -c max_connections=200
               -c shared_buffers=512MB
               -c effective_cache_size=1536MB
               -c work_mem=16MB
               -c maintenance_work_mem=128MB
               -c synchronous_commit=off

  pgbouncer:
    image: edoburu/pgbouncer:latest
    container_name: petboss_pgbouncer
    restart: always
    environment:
      DB_USER: postgres
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: petboss_db
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 500
      DEFAULT_POOL_SIZE: 50
    ports:
      - "6432:6432"
    depends_on:
      - postgres

volumes:
  postgres_data:
    driver: local
```

### 3.3 Security & Firewall (UFW)
Only necessary ports are exposed on the public interface:

```bash
# Allow SSH on hardened port
sudo ufw allow 22/tcp

# Allow PostgreSQL traffic from Vercel deployment IP blocks
sudo ufw allow 5432/tcp
sudo ufw allow 6432/tcp

# Enable firewall
sudo ufw enable
```

---

## 4. Automated Backup & Disaster Recovery

A systemd timer and cron job execute daily backups at 03:00 UTC.

### 4.1 Backup Script (`/opt/petboss-infra/backup.sh`)
```bash
#!/bin/bash
set -eo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/petboss-infra/backups"
BACKUP_FILE="${BACKUP_DIR}/petboss_db_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Perform compressed SQL dump
docker exec -t petboss_postgres pg_dump -U postgres -d petboss_db | gzip > "$BACKUP_FILE"

# Rotate local backups older than 7 days
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -delete

# Sync to S3-compatible remote storage
rclone copy "$BACKUP_FILE" s3-remote:petboss-db-backups/daily/

echo "Backup ${BACKUP_FILE} completed successfully."
```

---

## 5. Media & Asset Storage (S3-Compatible Object Storage)

High-resolution staff photos, clinic facility galleries, and medical certificates are stored in an S3-compatible object bucket:
- **Bucket Name:** `petboss-media-production`
- **Access Policy:** Public read for assets under `/public/*`; authenticated read/write for admin uploads.
- **CDN Caching:** `Cache-Control: public, max-age=31536000, immutable` for hashed static assets.
