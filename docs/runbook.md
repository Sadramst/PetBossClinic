# Operations & Incident Runbook — Pet Boss Clinic

> **Operational Procedures, Deployments & Disaster Recovery**  
> Standard Operating Procedures (SOPs) for site reliability, scheduled maintenance, and incident management.

---

## 1. Routine Deployment Procedure

### 1.1 Automated Git Deployments
All production releases are driven by Git pushes to the `main` branch.

```bash
# 1. Ensure local tests and lint pass before pushing
npm run typecheck
npm run lint
npm test
npm run build

# 2. Push changes to origin main
git push origin main
```

### 1.2 Deployment Health Verification
Once Vercel finishes the build:
1. Visit `https://www.petbossclinic.com/api/health` to ensure HTTP 200 and database connectivity.
2. Inspect `https://www.petbossclinic.com/` (Persian root) to verify RTL layout, font rendering, and golden pill badge components.
3. Check `https://www.petbossclinic.com/en` (English route) to confirm LTR orientation.
4. Verify `/admin/theme` live switcher is responding without server errors.

---

## 2. Database Migration Runbook

Prisma migrations must be executed carefully to avoid locking tables in production.

### 2.1 Applying Schema Migrations
```bash
# Run on CI or directly connected bastion
npx prisma migrate deploy
```

### 2.2 Seeding Verification
If introducing new baseline clinic services or species/breeds:
```bash
npx tsx prisma/seed.ts
```

---

## 3. Database Disaster Recovery & Restore

### 3.1 Restoring from Daily Backup
In the event of database corruption or accidental data loss:

```bash
# SSH into Vultr VPS
ssh root@95.179.243.160

# 1. Stop web traffic or activate maintenance mode
# 2. Locate latest healthy snapshot
LATEST_BACKUP=$(ls -t /opt/petboss-infra/backups/*.sql.gz | head -n 1)
echo "Restoring from: $LATEST_BACKUP"

# 3. Terminate active connections and drop current schema
docker exec -i petboss_postgres psql -U postgres -d petboss_db -c "
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'petboss_db' AND pid <> pg_backend_pid();
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
"

# 4. Stream and restore uncompressed dump
gunzip -c "$LATEST_BACKUP" | docker exec -i petboss_postgres psql -U postgres -d petboss_db

# 5. Verify restored record counts
docker exec -i petboss_postgres psql -U postgres -d petboss_db -c "SELECT count(*) FROM \"Service\";"
```

---

## 4. Secret & Credential Rotation

### 4.1 Database Credentials
1. Generate a new 32-character high-entropy password:
   ```bash
   openssl rand -base64 24
   ```
2. Update PostgreSQL password on Vultr:
   ```sql
   ALTER USER postgres WITH PASSWORD 'NEW_STRONG_PASSWORD';
   ```
3. Update `DATABASE_URL` and `DIRECT_URL` in Vercel Project Settings → Environment Variables.
4. Trigger a production redeploy in Vercel.

### 4.2 NextAuth Secret Rotation
1. Generate new secret:
   ```bash
   openssl rand -hex 32
   ```
2. Update `NEXTAUTH_SECRET` in Vercel.
3. Redeploy. (Note: Existing user sessions will be invalidated, requiring staff to re-authenticate).

---

## 5. Rollback Procedures

### 5.1 Frontend Rollback (Instant)
If a release causes UI regressions:
1. Open the **Vercel Dashboard** → **Deployments**.
2. Locate the previous successful deployment.
3. Click the three dots `...` and select **Promote to Production**.
4. Rollback takes effect globally across Anycast edges in < 5 seconds.

### 5.2 Database Rollback
If a Prisma migration failed:
1. Revert the migration file in Git.
2. Mark migration as rolled back in Prisma migration table:
   ```bash
   npx prisma migrate resolve --rolled-back "<migration_name>"
   ```
3. Restore pre-migration backup if schema modifications caused destructive changes.

---

## 6. Incident Response Playbook

### High Latency or Database Connection Errors
- **Symptom:** Vercel logs show `PrismaClientInitializationError: Can't reach database server`.
- **Action:**
  1. Ping Vultr VPS: `ping 95.179.243.160`
  2. Check Docker container status:
     ```bash
     ssh root@95.179.243.160 "docker ps"
     ```
  3. Inspect PostgreSQL logs:
     ```bash
     docker logs --tail 100 petboss_postgres
     ```
  4. If connections exceeded, inspect active connections:
     ```sql
     SELECT count(*), state FROM pg_stat_activity GROUP BY state;
     ```
