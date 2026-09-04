# DNS & Domain Configuration — Pet Boss Clinic

> **Domain Management & DNS Zone Records**  
> Complete configuration guide for `petbossclinic.com` registered through VentraIP and routed to Vercel's global edge network.

---

## 1. Domain Registration Details

- **Domain Name:** `petbossclinic.com`
- **Registrar:** VentraIP (ventraip.com.au)
- **Nameserver Mode:** External DNS Records (VentraIP Default Nameservers)
- **Canonical Domain:** `https://www.petbossclinic.com`
- **Apex Redirection:** `petbossclinic.com` automatically redirects (HTTP 308 Permanent) to `https://www.petbossclinic.com`.

---

## 2. DNS Zone Records Matrix

Configure the following records in the VentraIP VIPControl DNS Management Console:

| Type | Name / Host | Value / Target | TTL | Purpose |
|---|---|---|---|---|
| **A** | `@` | `76.76.21.21` | 300 | Vercel Apex Anycast Routing |
| **CNAME** | `www` | `cname.vercel-dns.com.` | 300 | Primary Canonical Web Traffic |
| **TXT** | `@` | `google-site-verification=XXXXXXXXXXXXXXXXXXXX` | 3600 | Google Search Console Ownership |
| **TXT** | `_vercel` | `vc-domain-verify=petbossclinic.com,XXXXXXXXXXXXXXXX` | 300 | Vercel Domain Verification |
| **TXT** | `@` | `"v=spf1 include:_spf.google.com ~all"` | 3600 | SPF Email Authentication |
| **TXT** | `_dmarc` | `"v=DMARC1; p=none; rua=mailto:postmaster@petbossclinic.com"` | 3600 | DMARC Reporting Policy |

---

## 3. SSL / TLS Certificate Automation

- **Certificate Provider:** Let's Encrypt / DigiCert via Vercel
- **Renewal Process:** 100% automated 30 days prior to expiry
- **Protocols Supported:** TLS 1.2, TLS 1.3
- **Security Headers Injected at Edge:**
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 4. Verification & Diagnostics

Run the following terminal commands to verify global propagation:

```bash
# Verify Apex A record
dig +short A petbossclinic.com
# Expected output: 76.76.21.21

# Verify WWW CNAME record
dig +short CNAME www.petbossclinic.com
# Expected output: cname.vercel-dns.com.

# Verify HTTP to HTTPS and WWW redirection
curl -I http://petbossclinic.com
# Expected: HTTP/1.1 308 Permanent Redirect -> Location: https://www.petbossclinic.com/
```
