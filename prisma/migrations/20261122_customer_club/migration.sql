DO $$ BEGIN
  CREATE TYPE "PetSpecies" AS ENUM ('DOG', 'CAT', 'BIRD', 'RABBIT', 'FISH', 'REPTILE', 'RODENT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PetSex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PetRecordKind" AS ENUM ('VACCINE', 'DEWORMING', 'CHECKUP', 'SURGERY', 'GROOMING', 'DENTAL', 'WEIGHT', 'TREATMENT', 'NOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PointsKind" AS ENUM ('SIGNUP', 'FIRST_PET', 'PET_PROFILE', 'ORDER', 'SERVICE', 'REFERRAL_GIVEN', 'REFERRAL_JOINED', 'BIRTHDAY', 'REVIEW', 'REDEEM', 'ADJUST', 'EXPIRE', 'REVERSAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS     "consumeDays" INTEGER,
ADD COLUMN IF NOT EXISTS     "forSpecies" "PetSpecies"[];

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS     "birthDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "city" TEXT,
ADD COLUMN IF NOT EXISTS     "createdByAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "gender" TEXT,
ADD COLUMN IF NOT EXISTS     "lastOrderAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "marketingConsentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "marketingSmsConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "notes" TEXT,
ADD COLUMN IF NOT EXISTS     "ordersCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "pointsBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "referralCode" TEXT,
ADD COLUMN IF NOT EXISTS     "referredById" TEXT,
ADD COLUMN IF NOT EXISTS     "source" TEXT,
ADD COLUMN IF NOT EXISTS     "tags" TEXT[],
ADD COLUMN IF NOT EXISTS     "tier" TEXT NOT NULL DEFAULT 'BRONZE',
ADD COLUMN IF NOT EXISTS     "totalSpent" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "ClubPet" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" "PetSpecies" NOT NULL,
    "breed" TEXT,
    "sex" "PetSex" NOT NULL DEFAULT 'UNKNOWN',
    "birthDate" TIMESTAMP(3),
    "adoptedAt" TIMESTAMP(3),
    "weightKg" DOUBLE PRECISION,
    "neutered" BOOLEAN,
    "color" TEXT,
    "microchip" TEXT,
    "photoUrl" TEXT,
    "foodBrand" TEXT,
    "foodProductId" TEXT,
    "allergies" TEXT,
    "medicalNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deceasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubPet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PetRecord" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "kind" "PetRecordKind" NOT NULL,
    "title" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL,
    "nextDueAt" TIMESTAMP(3),
    "valueNumber" DOUBLE PRECISION,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'customer',
    "visitId" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceVisit" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "petId" TEXT,
    "serviceId" TEXT,
    "serviceName" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "doctor" TEXT,
    "notes" TEXT,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceVisit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PointsTransaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "PointsKind" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LoyaltyConfig" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pointsPerThousandToman" INTEGER NOT NULL DEFAULT 1,
    "serviceMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "signupBonus" INTEGER NOT NULL DEFAULT 50,
    "firstPetBonus" INTEGER NOT NULL DEFAULT 30,
    "petProfileBonus" INTEGER NOT NULL DEFAULT 20,
    "reviewBonus" INTEGER NOT NULL DEFAULT 10,
    "birthdayBonus" INTEGER NOT NULL DEFAULT 100,
    "referralGiven" INTEGER NOT NULL DEFAULT 150,
    "referralJoined" INTEGER NOT NULL DEFAULT 100,
    "pointValueToman" INTEGER NOT NULL DEFAULT 100,
    "tiersJson" JSONB NOT NULL,
    "pointsExpireMonths" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Reward" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "couponType" "CouponType" NOT NULL,
    "couponValue" INTEGER NOT NULL,
    "couponMaxDiscount" INTEGER,
    "couponMinSubtotal" INTEGER NOT NULL DEFAULT 0,
    "couponValidDays" INTEGER NOT NULL DEFAULT 30,
    "minTier" TEXT,
    "stock" INTEGER,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RewardRedemption" (
    "id" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "couponId" TEXT,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Segment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "segmentId" TEXT,
    "rulesSnapshot" JSONB,
    "body" TEXT NOT NULL,
    "couponTemplate" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "recipientsCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "convertedCount" INTEGER NOT NULL DEFAULT 0,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageOutbox" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "phone" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "providerRef" TEXT,
    "campaignId" TEXT,
    "couponId" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AutomationRule" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "params" JSONB NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "couponTemplate" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CartSnapshot" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastReminderAt" TIMESTAMP(3),
    "recoveredOrderId" TEXT,

    CONSTRAINT "CartSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdminCustomerNote" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "adminId" TEXT,
    "adminName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminCustomerNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClubPet_customerId_idx" ON "ClubPet"("customerId");

CREATE INDEX IF NOT EXISTS "PetRecord_petId_doneAt_idx" ON "PetRecord"("petId", "doneAt");

CREATE INDEX IF NOT EXISTS "PetRecord_nextDueAt_idx" ON "PetRecord"("nextDueAt");

CREATE INDEX IF NOT EXISTS "ServiceVisit_customerId_visitedAt_idx" ON "ServiceVisit"("customerId", "visitedAt");

CREATE INDEX IF NOT EXISTS "ServiceVisit_petId_idx" ON "ServiceVisit"("petId");

CREATE INDEX IF NOT EXISTS "PointsTransaction_customerId_createdAt_idx" ON "PointsTransaction"("customerId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PointsTransaction_customerId_kind_refId_key" ON "PointsTransaction"("customerId", "kind", "refId");

CREATE INDEX IF NOT EXISTS "RewardRedemption_customerId_createdAt_idx" ON "RewardRedemption"("customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "MessageCampaign_status_scheduledFor_idx" ON "MessageCampaign"("status", "scheduledFor");

CREATE UNIQUE INDEX IF NOT EXISTS "MessageOutbox_dedupeKey_key" ON "MessageOutbox"("dedupeKey");

CREATE INDEX IF NOT EXISTS "MessageOutbox_status_scheduledFor_idx" ON "MessageOutbox"("status", "scheduledFor");

CREATE INDEX IF NOT EXISTS "MessageOutbox_customerId_createdAt_idx" ON "MessageOutbox"("customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "MessageOutbox_campaignId_idx" ON "MessageOutbox"("campaignId");

CREATE UNIQUE INDEX IF NOT EXISTS "AutomationRule_kind_key" ON "AutomationRule"("kind");

CREATE UNIQUE INDEX IF NOT EXISTS "CartSnapshot_customerId_key" ON "CartSnapshot"("customerId");

CREATE INDEX IF NOT EXISTS "CartSnapshot_updatedAt_idx" ON "CartSnapshot"("updatedAt");

CREATE INDEX IF NOT EXISTS "AdminCustomerNote_customerId_createdAt_idx" ON "AdminCustomerNote"("customerId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_referralCode_key" ON "Customer"("referralCode");

CREATE INDEX IF NOT EXISTS "Customer_tier_idx" ON "Customer"("tier");

CREATE INDEX IF NOT EXISTS "Customer_lastOrderAt_idx" ON "Customer"("lastOrderAt");

DO $$ BEGIN
  ALTER TABLE "ClubPet" ADD CONSTRAINT "ClubPet_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetRecord" ADD CONSTRAINT "PetRecord_petId_fkey" FOREIGN KEY ("petId") REFERENCES "ClubPet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_petId_fkey" FOREIGN KEY ("petId") REFERENCES "ClubPet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MessageCampaign" ADD CONSTRAINT "MessageCampaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MessageOutbox" ADD CONSTRAINT "MessageOutbox_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MessageOutbox" ADD CONSTRAINT "MessageOutbox_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MessageCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CartSnapshot" ADD CONSTRAINT "CartSnapshot_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AdminCustomerNote" ADD CONSTRAINT "AdminCustomerNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Consent must be an explicit action: default off, and nobody is opted in without a recorded opt-in.
ALTER TABLE "Customer" ALTER COLUMN "marketingSmsConsent" SET DEFAULT false;
UPDATE "Customer" SET "marketingSmsConsent" = false WHERE "marketingSmsConsent" = true AND "marketingConsentAt" IS NULL;
