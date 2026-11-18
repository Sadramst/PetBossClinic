-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED', 'FREE_SHIPPING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponCode" TEXT,
ADD COLUMN IF NOT EXISTS "couponId" TEXT,
ADD COLUMN IF NOT EXISTS "shippingDiscount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CouponType" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "maxDiscount" INTEGER,
    "minSubtotal" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoApply" BOOLEAN NOT NULL DEFAULT false,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "perCustomerLimit" INTEGER DEFAULT 1,
    "firstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT,
    "groupId" TEXT,
    "categoryIds" TEXT[],
    "brandIds" TEXT[],
    "productIds" TEXT[],
    "source" TEXT NOT NULL DEFAULT 'manual',
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerGroupMember" (
    "groupId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerGroupMember_pkey" PRIMARY KEY ("groupId","customerId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MarketingContact" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "source" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,
    "welcomeCouponId" TEXT,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MarketingConfig" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "popupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "popupTitle" TEXT NOT NULL DEFAULT '۱۰٪ تخفیف اولین خرید شما',
    "popupText" TEXT NOT NULL DEFAULT 'شماره موبایل یا ایمیل خود را وارد کنید تا کد تخفیف شخصی‌تان همین حالا ساخته شود.',
    "popupDelaySeconds" INTEGER NOT NULL DEFAULT 8,
    "welcomeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "welcomeType" "CouponType" NOT NULL DEFAULT 'PERCENT',
    "welcomeValue" INTEGER NOT NULL DEFAULT 10,
    "welcomeMaxDiscount" INTEGER,
    "welcomeMinSubtotal" INTEGER NOT NULL DEFAULT 0,
    "welcomeValidDays" INTEGER NOT NULL DEFAULT 14,
    "bannerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "bannerText" TEXT,
    "bannerLink" TEXT,
    "bannerEndsAt" TIMESTAMP(3),
    "bannerCouponCode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Coupon_isActive_endsAt_idx" ON "Coupon"("isActive", "endsAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Coupon_batchId_idx" ON "Coupon"("batchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Coupon_customerId_idx" ON "Coupon"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Coupon_groupId_idx" ON "Coupon"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_customerId_idx" ON "CouponRedemption"("couponId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerGroup_name_key" ON "CustomerGroup"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerGroupMember_customerId_idx" ON "CustomerGroupMember"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingContact_email_key" ON "MarketingContact"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingContact_phone_key" ON "MarketingContact"("phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarketingContact_createdAt_idx" ON "MarketingContact"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarketingContact_customerId_idx" ON "MarketingContact"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_couponId_idx" ON "Order"("couponId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CustomerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerGroupMember" ADD CONSTRAINT "CustomerGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CustomerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerGroupMember" ADD CONSTRAINT "CustomerGroupMember_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MarketingContact" ADD CONSTRAINT "MarketingContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

