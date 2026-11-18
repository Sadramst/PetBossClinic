-- Customers can sign up and log in with an email address as well as a mobile number.
-- Normalise existing addresses, drop blanks, keep the oldest account when two share one, then enforce uniqueness.
UPDATE "Customer" SET "email" = lower(btrim("email")) WHERE "email" IS NOT NULL;
UPDATE "Customer" SET "email" = NULL WHERE "email" = '';
UPDATE "Customer" c SET "email" = NULL
 WHERE c."email" IS NOT NULL
   AND EXISTS (SELECT 1 FROM "Customer" o WHERE o."email" = c."email" AND (o."createdAt", o."id") < (c."createdAt", c."id"));
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_email_key" ON "Customer"("email");
