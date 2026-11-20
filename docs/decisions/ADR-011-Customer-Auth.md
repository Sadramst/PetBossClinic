# ADR 011: Customer authentication

- **Status:** Accepted
- **Date:** 2026-11

## Context
Customers are Iranian mobile users; email is optional.

## Decision
Phone plus password (scrypt) with SMS OTP for sign-up and recovery, HMAC session cookie (`lib/customer/session.ts`), rate limits on OTP and login. Admin uses a separate cookie `petboss_session` (ADR-007). Rotating `AUTH_SECRET` logs out both.
