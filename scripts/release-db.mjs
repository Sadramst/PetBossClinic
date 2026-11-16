/**
 * Production release step, run by `npm run build` on Vercel before `next build`.
 *
 * Only acts when VERCEL_ENV=production (or with --force for a local rehearsal):
 *   1. Refuses to release without AUTH_SECRET (admin login would be unusable).
 *   2. Checks the tables this release builds on exist (detects schema drift).
 *   3. Applies each SQL migration in prisma/migrations/ that is not applied yet,
 *      inside a transaction. Every migration is additive (new tables/columns).
 *   4. One-time data steps on first release: Persian text cleanup, brand linking,
 *      starter blog drafts.
 * Any failure exits non-zero, so the build fails and the current site stays live.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const force = process.argv.includes('--force');
if (process.env.VERCEL_ENV !== 'production' && !force) {
  console.log('[release-db] not a production build: skipping database release steps.');
  process.exit(0);
}

const fail = (msg) => {
  console.error(`\n[release-db] RELEASE BLOCKED: ${msg}\n`);
  process.exit(1);
};

if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  fail('AUTH_SECRET is not set in the Vercel production environment. Set it (openssl rand -hex 32) and redeploy.');
}
if (!process.env.CRON_SECRET) {
  console.warn('[release-db] warning: CRON_SECRET is not set; the daily expiry job will be rejected (401).');
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) fail('DATABASE_URL is not set.');

const client = new pg.Client({ connectionString: url, statement_timeout: 60000 });
await client.connect();

const tableExists = async (t) =>
  (await client.query(`select to_regclass($1) as r`, [`public."${t}"`])).rows[0].r !== null;
const columnExists = async (t, c) =>
  (
    await client.query(`select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2`, [t, c])
  ).rowCount > 0;

/** Each migration declares how to tell whether it is already applied. */
const MIGRATIONS = [
  {
    dir: '20261116_product_expiry_batches',
    applied: async () => (await columnExists('Product', 'tracksExpiry')) && (await columnExists('Inventory', 'expiryDate')),
  },
  {
    dir: '20261117_customers_orders',
    applied: async () => {
      const tables = ['Customer', 'OtpCode', 'Address', 'Order', 'OrderItem', 'Payment'];
      const present = [];
      for (const t of tables) present.push(await tableExists(t));
      if (present.every(Boolean)) return true;
      if (present.some(Boolean)) {
        fail(`partial shop schema found (${tables.filter((_, i) => present[i]).join(', ')} exist). Inspect the database manually.`);
      }
      return false;
    },
  },
];

try {
  const required = ['Product', 'ProductCategory', 'Brand', 'Inventory', 'SeoSetting', 'LoginAttempt', 'AuditLog', 'Post', 'PostCategory'];
  const missing = [];
  for (const t of required) if (!(await tableExists(t))) missing.push(t);
  if (missing.length) fail(`expected tables are missing: ${missing.join(', ')} (schema drift).`);

  for (const m of MIGRATIONS) {
    if (await m.applied()) {
      console.log(`[release-db] ${m.dir}: already applied`);
      continue;
    }
    const sql = readFileSync(new URL(`../prisma/migrations/${m.dir}/migration.sql`, import.meta.url), 'utf8');
    console.log(`[release-db] ${m.dir}: applying…`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      fail(`${m.dir} failed and was rolled back: ${err.message}`);
    }
    if (!(await m.applied())) fail(`${m.dir} ran but its checks still fail.`);
    console.log(`[release-db] ${m.dir}: applied`);
  }

  // One-time data steps (each script is idempotent; these guards just avoid re-running them every build).
  const brandCount = Number((await client.query('select count(*) from "Brand"')).rows[0].count);
  const postCount = Number((await client.query('select count(*) from "Post"')).rows[0].count);
  await client.end();

  const run = (script, ...args) => {
    console.log(`[release-db] running ${script} ${args.join(' ')}`);
    execFileSync('npx', ['tsx', `scripts/${script}`, ...args], { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
  };
  if (brandCount === 0) {
    run('normalize-persian-text.ts', '--apply');
    run('assign-brands.ts', '--apply');
  }
  if (postCount === 0) run('seed-blog-drafts.ts');

  console.log('[release-db] database ready for this release.');
} catch (err) {
  fail(err?.message ?? String(err));
}
