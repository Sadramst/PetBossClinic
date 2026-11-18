-- Order integrity (additive, idempotent: safe to run more than once).
--  * OrderItem.allocations : which stock batches an order line was taken from, so a
--    cancelled order returns exactly those units (never more) to the same batches.
--  * Order.idempotencyKey  : a double-submitted checkout returns the same order.
--  * Customer.sessionVersion: logging out invalidates every earlier session token.
--  * OtpCode (ip, createdAt): durable per-network limit on login-code SMS.

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "allocations" JSONB;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "OtpCode_ip_createdAt_idx" ON "OtpCode"("ip", "createdAt");
