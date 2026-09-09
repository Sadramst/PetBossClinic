# ADR 008: Rate Limiting Evolution — In-Memory Stopgap to Distributed Redis (Upstash)

## Context
In WS-0.1, a sliding-window rate limiter (`lib/utils/rate-limit.ts`) was implemented to protect public lead capture (`createLeadAction`) from bot flooding and denial-of-wallet attacks. 

## Architectural Limitation
The current implementation uses process memory (`Map<string, RateLimitRecord>`). In serverless environments such as Vercel:
- Multiple ephemeral lambdas handle concurrent incoming requests.
- Instances scale up and down dynamically; memory is not shared across instances.
- An attacker can distribute requests or hit different regional edge/lambda endpoints, effectively resetting the counter.

## Current Role
In WS-0, the in-memory limiter acts as an immediate **best-effort stopgap** preventing single-instance burst floods and naive bot scripts without introducing third-party external dependencies or cloud latency.

## Target Architecture (Scheduled for WS-4 / WS-5)
1. Provision **Upstash Redis** (or Vercel KV).
2. Use `@upstash/ratelimit` with sliding-window algorithm.
3. Key format: `ratelimit:leads:${ip}`.
4. Fallback gracefully to in-memory limiter if Redis connection is unavailable.
