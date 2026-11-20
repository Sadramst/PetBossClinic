# ADR 014: SMS outbox and consent rules

- **Status:** Accepted
- **Date:** 2026-11

## Context
Messages must be reliable, deduplicated and consent-aware.

## Decision
All SMS goes through `MessageOutbox` with a dedupe key, retry and status (QUEUED, SENDING, SENT, FAILED, SKIPPED, CANCELLED). Marketing kinds require consent; STOP replies (inbound webhook, `SMS_INBOUND_SECRET`) revoke it. Campaigns and automations only enqueue; a worker sends. Provider is `SMS_PROVIDER` (kavenegar, smsir, console).
