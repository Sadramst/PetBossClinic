/**
 * One command that checks the whole system, in order, and stops at the first failure:
 *
 *   1. typecheck       tsc --noEmit
 *   2. lint            eslint
 *   3. unit+integration vitest (integration tests need DATABASE_URL pointing at a local Postgres)
 *   4. build           production build (also proves every page compiles)
 *   5. e2e             Playwright on desktop + phone against the production build
 *
 *   npm run test:all                   everything
 *   npm run test:all -- --skip-e2e     fast checks only (1-4)
 *   npm run test:all -- --only=e2e     a single step: typecheck | lint | unit | build | e2e
 *
 * Environment: DATABASE_URL, DIRECT_URL, AUTH_SECRET, INITIAL_ADMIN_PASSWORD (see .env.example).
 * E2E_PORT (default 3200) is the port of the temporary production server Playwright starts.
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
const skipE2e = args.includes('--skip-e2e');

const env = { ...process.env, E2E_PROD: '1', E2E_PORT: process.env.E2E_PORT || '3200' };

const STEPS = [
  { id: 'typecheck', label: 'Typecheck', cmd: 'npx tsc --noEmit' },
  { id: 'lint', label: 'Lint', cmd: 'npx eslint .' },
  { id: 'unit', label: 'Unit + integration tests', cmd: 'npx vitest run -c vitest.config.mts' },
  { id: 'build', label: 'Production build', cmd: 'npm run build' },
  { id: 'e2e', label: 'End-to-end tests (desktop + phone)', cmd: 'npx playwright test --retries=0' },
];

const selected = STEPS.filter((s) => (only ? s.id === only : !(skipE2e && s.id === 'e2e')));
if (selected.length === 0) {
  console.error(`Unknown step "${only}". Use: ${STEPS.map((s) => s.id).join(' | ')}`);
  process.exit(2);
}
if (selected.some((s) => s.id === 'unit' || s.id === 'e2e') && !process.env.DATABASE_URL) {
  console.warn('! DATABASE_URL is not set: database integration and e2e tests will be skipped or fail.\n');
}

// The tests create and delete customers, orders and stock. Refuse to run against a real database:
// the host is parsed, so "localhost" inside a query string or a look-alike domain does not pass.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
if (process.env.DATABASE_URL) {
  let host = '';
  try {
    host = new URL(process.env.DATABASE_URL).hostname.toLowerCase();
  } catch {
    /* unparsable: treated as not local */
  }
  if (!LOCAL_HOSTS.has(host)) {
    console.error('✗ DATABASE_URL does not point at this machine. test:all creates and deletes data; use a local PostgreSQL.');
    process.exit(2);
  }
}

const results = [];
for (const step of selected) {
  console.log(`\n━━━ ${step.label} ━━━`);
  const started = Date.now();
  const r = spawnSync(step.cmd, { stdio: 'inherit', shell: true, env });
  const seconds = Math.round((Date.now() - started) / 1000);
  results.push({ step: step.label, status: r.status === 0 ? 'PASS' : 'FAIL', seconds });
  if (r.status !== 0) break;
}

console.log('\n━━━ Summary ━━━');
for (const r of results) console.log(`${r.status === 'PASS' ? '✓' : '✗'} ${r.step.padEnd(40)} ${String(r.seconds).padStart(4)}s`);
for (const s of selected.slice(results.length)) console.log(`- ${s.label.padEnd(40)} not run`);

const failed = results.find((r) => r.status === 'FAIL');
console.log(failed ? `\nFAILED at: ${failed.step}` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
