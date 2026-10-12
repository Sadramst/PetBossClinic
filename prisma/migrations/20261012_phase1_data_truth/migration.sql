-- CreateEnum
CREATE TYPE "PriceDisplayMode" AS ENUM ('RANGE', 'FROM', 'ON_REQUEST');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "priceDisplayMode" "PriceDisplayMode" NOT NULL DEFAULT 'ON_REQUEST';

-- CreateTable
CREATE TABLE "HomepageSection" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "titleFa" TEXT,
    "titleEn" TEXT,
    "subtitleFa" TEXT,
    "subtitleEn" TEXT,
    "eyebrowFa" TEXT,
    "eyebrowEn" TEXT,
    "badgeFa" TEXT,
    "badgeEn" TEXT,
    "ctaLabelFa" TEXT,
    "ctaLabelEn" TEXT,
    "ctaHref" TEXT,
    "imageId" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomepageSection_key_key" ON "HomepageSection"("key");

-- CreateIndex
CREATE INDEX "HomepageSection_isVisible_sortOrder_idx" ON "HomepageSection"("isVisible", "sortOrder");

-- CreateIndex
CREATE INDEX "Product_isFeatured_idx" ON "Product"("isFeatured");
