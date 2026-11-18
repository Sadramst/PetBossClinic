-- Customer password login (additive, idempotent: safe to run more than once).
--  * passwordHash     : scrypt hash; NULL for customers who only use SMS codes.
--  * phoneVerifiedAt  : when the customer proved they own the number (SMS code).
--  * failedLogins / lastFailedAt : wrong-password counter for the 15-minute lock.

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "failedLogins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lastFailedAt" TIMESTAMP(3);

-- Every customer that exists before this release signed up with an SMS code,
-- so their number is already verified.
UPDATE "Customer"
SET "phoneVerifiedAt" = COALESCE("lastLoginAt", "createdAt")
WHERE "phoneVerifiedAt" IS NULL AND "passwordHash" IS NULL;
