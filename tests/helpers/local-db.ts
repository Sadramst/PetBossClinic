/**
 * Tests that create and delete customers, orders and stock must never run against a real
 * database. The host is parsed (not searched for the text "localhost"), so a URL such as
 * `postgres://u:p@db.example.com/x?host=localhost` or `localhost.evil.com` does not pass.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Throws with a clear message when DATABASE_URL is set but points anywhere but this machine. */
export function assertLocalDatabase(url: string | undefined = process.env.DATABASE_URL): void {
  if (url && !isLocalDatabaseUrl(url)) {
    throw new Error(
      'Refusing to run tests: DATABASE_URL does not point at this machine. ' +
        'The tests create and delete customers, orders and stock. Use a local PostgreSQL (see docs/test-flow.md).'
    );
  }
}
