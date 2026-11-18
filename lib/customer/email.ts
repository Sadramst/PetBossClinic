const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Lower-case, trimmed address, or null when it is not a plausible email. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  return email.length <= 120 && EMAIL_RE.test(email) ? email : null
}
