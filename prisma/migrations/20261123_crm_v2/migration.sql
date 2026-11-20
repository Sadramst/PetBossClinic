-- CRM v2: contact spine, pipeline, tasks, timeline, tickets, saved views, health, staff notifications, expiry config.
-- Purely additive and idempotent: safe to run twice. Backfill is a separate script (scripts/backfill-crm.ts).

DO $$ BEGIN
  CREATE TYPE "LifecycleStage" AS ENUM ('SUBSCRIBER', 'LEAD', 'PROSPECT', 'NEW_CUSTOMER', 'ACTIVE', 'AT_RISK', 'LAPSED', 'VIP', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT_BOOKED', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LostReason" AS ENUM ('NO_RESPONSE', 'PRICE', 'NOT_INTERESTED', 'WENT_ELSEWHERE', 'DUPLICATE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskType" AS ENUM ('CALL', 'SMS', 'FOLLOW_UP', 'VACCINE_REMINDER', 'WIN_BACK', 'CART', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AdjustmentReason" AS ENUM ('COUNT', 'DAMAGE', 'RETURN', 'WRITE_OFF', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StaffNotificationKind" AS ENUM ('NEW_ORDER', 'NEW_LEAD', 'NEW_TICKET', 'TASK_DUE', 'EXPIRY_DIGEST', 'OUTBOX_FAILURES');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Contact" (
  "id" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "name" TEXT,
  "stage" "LifecycleStage" NOT NULL DEFAULT 'LEAD',
  "stageOverride" "LifecycleStage",
  "customerId" TEXT,
  "mergedIntoId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_phone_key" ON "Contact"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_email_key" ON "Contact"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_customerId_key" ON "Contact"("customerId");
CREATE INDEX IF NOT EXISTS "Contact_stage_idx" ON "Contact"("stage");

CREATE TABLE IF NOT EXISTS "CrmTask" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" "TaskType" NOT NULL DEFAULT 'OTHER',
  "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
  "priority" INTEGER NOT NULL DEFAULT 2,
  "dueAt" TIMESTAMP(3),
  "ownerId" TEXT,
  "contactId" TEXT,
  "customerId" TEXT,
  "leadId" TEXT,
  "ticketId" TEXT,
  "dedupeKey" TEXT,
  "system" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmTask_dedupeKey_key" ON "CrmTask"("dedupeKey");
CREATE INDEX IF NOT EXISTS "CrmTask_ownerId_status_dueAt_idx" ON "CrmTask"("ownerId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "CrmTask_customerId_idx" ON "CrmTask"("customerId");
CREATE INDEX IF NOT EXISTS "CrmTask_leadId_idx" ON "CrmTask"("leadId");

CREATE TABLE IF NOT EXISTS "CrmActivity" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "contactId" TEXT,
  "customerId" TEXT,
  "actorUserId" TEXT,
  "refType" TEXT NOT NULL DEFAULT '',
  "refId" TEXT NOT NULL DEFAULT '',
  "summary" TEXT NOT NULL,
  "meta" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmActivity_type_refType_refId_key" ON "CrmActivity"("type", "refType", "refId");
CREATE INDEX IF NOT EXISTS "CrmActivity_customerId_occurredAt_idx" ON "CrmActivity"("customerId", "occurredAt");
CREATE INDEX IF NOT EXISTS "CrmActivity_contactId_occurredAt_idx" ON "CrmActivity"("contactId", "occurredAt");

CREATE TABLE IF NOT EXISTS "TicketReply" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "authorUserId" TEXT,
  "internal" BOOLEAN NOT NULL DEFAULT false,
  "channel" TEXT,
  "body" TEXT NOT NULL,
  "outboxId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketReply_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TicketReply_messageId_createdAt_idx" ON "TicketReply"("messageId", "createdAt");

CREATE TABLE IF NOT EXISTS "SavedView" (
  "id" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "sort" TEXT,
  "ownerId" TEXT,
  "shared" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SavedView_entity_ownerId_idx" ON "SavedView"("entity", "ownerId");

CREATE TABLE IF NOT EXISTS "HealthSnapshot" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "churnRisk" TEXT NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HealthSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HealthSnapshot_customerId_computedAt_idx" ON "HealthSnapshot"("customerId", "computedAt");

CREATE TABLE IF NOT EXISTS "StaffNotification" (
  "id" TEXT NOT NULL,
  "kind" "StaffNotificationKind" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "href" TEXT,
  "userId" TEXT,
  "minRole" TEXT,
  "readBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "dedupeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffNotification_dedupeKey_key" ON "StaffNotification"("dedupeKey");
CREATE INDEX IF NOT EXISTS "StaffNotification_createdAt_idx" ON "StaffNotification"("createdAt");

CREATE TABLE IF NOT EXISTS "InventoryAdjustment" (
  "id" TEXT NOT NULL,
  "inventoryId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" "AdjustmentReason" NOT NULL,
  "note" TEXT,
  "costAtLoss" INTEGER,
  "adminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InventoryAdjustment_productId_createdAt_idx" ON "InventoryAdjustment"("productId", "createdAt");
CREATE INDEX IF NOT EXISTS "InventoryAdjustment_reason_createdAt_idx" ON "InventoryAdjustment"("reason", "createdAt");

CREATE TABLE IF NOT EXISTS "ExpiryConfig" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "soonDays" INTEGER NOT NULL DEFAULT 90,
  "criticalDays" INTEGER NOT NULL DEFAULT 30,
  "minShelfLifeDays" INTEGER NOT NULL DEFAULT 7,
  "discountStartDays" INTEGER NOT NULL DEFAULT 60,
  "discountPercent" INTEGER NOT NULL DEFAULT 20,
  "digestPhones" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExpiryConfig_pkey" PRIMARY KEY ("id")
);

-- Existing tables: nullable or defaulted columns only
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lifecycleStage" "LifecycleStage";
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "healthScore" INTEGER;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "churnRisk" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lastContactedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "mergedIntoId" TEXT;
CREATE INDEX IF NOT EXISTS "Customer_contactId_idx" ON "Customer"("contactId");
CREATE INDEX IF NOT EXISTS "Customer_lifecycleStage_idx" ON "Customer"("lifecycleStage");
CREATE INDEX IF NOT EXISTS "Customer_ownerId_idx" ON "Customer"("ownerId");

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "stage" "LeadStage" NOT NULL DEFAULT 'NEW';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lostReason" "LostReason";
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "normalizedPhone" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "stageChangedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Lead_stage_idx" ON "Lead"("stage");
CREATE INDEX IF NOT EXISTS "Lead_normalizedPhone_idx" ON "Lead"("normalizedPhone");
CREATE INDEX IF NOT EXISTS "Lead_ownerId_idx" ON "Lead"("ownerId");

ALTER TABLE "ContactMessage" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
ALTER TABLE "ContactMessage" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "ContactMessage" ADD COLUMN IF NOT EXISTS "normalizedPhone" TEXT;
ALTER TABLE "ContactMessage" ADD COLUMN IF NOT EXISTS "status" "TicketStatus" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "ContactMessage" ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;
ALTER TABLE "ContactMessage" ADD COLUMN IF NOT EXISTS "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "ContactMessage" ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMP(3);
ALTER TABLE "ContactMessage" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "ContactMessage_status_idx" ON "ContactMessage"("status");
CREATE INDEX IF NOT EXISTS "ContactMessage_assigneeId_idx" ON "ContactMessage"("assigneeId");

ALTER TABLE "MarketingContact" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shelfLifeDays" INTEGER;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "costPrice" INTEGER;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "supplier" TEXT;

-- Map legacy data once: leads keep their old status as a stage, owners carry over, and old read messages are not "open" tickets.
UPDATE "Lead" SET
  "stage" = (CASE UPPER(TRIM(COALESCE("status", '')))
    WHEN 'CONTACTED' THEN 'CONTACTED'
    WHEN 'QUALIFIED' THEN 'QUALIFIED'
    WHEN 'BOOKED' THEN 'APPOINTMENT_BOOKED'
    WHEN 'CONVERTED' THEN 'WON'
    WHEN 'WON' THEN 'WON'
    WHEN 'LOST' THEN 'LOST'
    WHEN 'CLOSED' THEN 'LOST'
    ELSE 'NEW' END)::"LeadStage",
  "ownerId" = COALESCE("ownerId", "assignedTo"),
  "stageChangedAt" = "updatedAt"
WHERE "stageChangedAt" IS NULL;

UPDATE "ContactMessage" SET
  "status" = 'RESOLVED'::"TicketStatus",
  "resolvedAt" = COALESCE("resolvedAt", "createdAt"),
  "firstResponseAt" = COALESCE("firstResponseAt", "createdAt")
WHERE "status" = 'OPEN' AND "resolvedAt" IS NULL AND "firstResponseAt" IS NULL
  AND ("isRead" = true OR "createdAt" < NOW() - INTERVAL '14 days')
  AND NOT EXISTS (SELECT 1 FROM "TicketReply" r WHERE r."messageId" = "ContactMessage"."id");
