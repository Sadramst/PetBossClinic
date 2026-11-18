const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Lower-case, trimmed address, or null when it is not a plausible email. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  return email.length <= 120 && EMAIL_RE.test(email) ? email : null
}

/**
 * One identity per real mailbox for lead capture: drops "+tag" suffixes and, for Gmail,
 * dots, so a+1@gmail.com and a.b@gmail.com cannot each mint a welcome coupon.
 */
export function canonicalEmail(raw: string): string | null {
  const email = normalizeEmail(raw)
  if (!email) return null
  const at = email.lastIndexOf('@')
  let local = email.slice(0, at).split('+')[0]
  let domain = email.slice(at + 1)
  if (domain === 'googlemail.com') domain = 'gmail.com'
  if (domain === 'gmail.com') local = local.replace(/\./g, '')
  return local ? `${local}@${domain}` : null
}
