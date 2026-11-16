-- Product expiry tracking: Inventory rows become dated stock batches.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "tracksExpiry" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "batchNumber" TEXT;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "manufactureDate" TIMESTAMP(3);
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3);
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Inventory_expiryDate_idx" ON "Inventory"("expiryDate");

-- Perishable categories track expiry by default.
UPDATE "Product" p SET "tracksExpiry" = true
FROM "ProductCategory" c
WHERE p."categoryId" = c."id"
  AND c."slugFa" IN ('cat-dry-food','cat-wet-food','cat-treats','dog-dry-food','dog-wet-food','dog-treats','medicines-supplements');
