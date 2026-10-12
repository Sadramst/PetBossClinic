-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'AUTHOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'TELEGRAM', 'WHATSAPP', 'FACEBOOK', 'X', 'LINKEDIN', 'YOUTUBE', 'APARAT', 'TIKTOK', 'PINTEREST');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'ON_BACKORDER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwoFactorToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "location" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "logoId" TEXT,
    "faviconId" TEXT,
    "taglineFa" TEXT,
    "taglineEn" TEXT,
    "activeTheme" TEXT DEFAULT 'petboss-luxury-dark',
    "heroTitleFa" TEXT,
    "heroTitleEn" TEXT,
    "heroSubtitleFa" TEXT,
    "heroSubtitleEn" TEXT,
    "addresses" JSONB,
    "geo" JSONB,
    "emails" JSONB,
    "phones" JSONB,
    "workingHours" JSONB,
    "holidayNotice" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialLink" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "url" TEXT NOT NULL,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactChannel" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "labelFa" TEXT,
    "labelEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavigationMenu" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavigationMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "parentId" TEXT,
    "labelFa" TEXT NOT NULL,
    "labelEn" TEXT,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redirect" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "permanent" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoSetting" (
    "id" TEXT NOT NULL,
    "gscVerification" TEXT,
    "ga4Id" TEXT,
    "gtmId" TEXT,
    "googleAdsId" TEXT,
    "bingId" TEXT,
    "enamadCode" TEXT,
    "samandehiCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSetting" (
    "id" TEXT NOT NULL,
    "metaPixel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceMode" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "messageFa" TEXT,
    "messageEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceMode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "titleFa" TEXT NOT NULL,
    "titleEn" TEXT,
    "link" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "tokens" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemePreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokens" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FontSetting" (
    "id" TEXT NOT NULL,
    "primary" TEXT NOT NULL DEFAULT 'Vazirmatn',
    "secondary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FontSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserThemePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preference" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserThemePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "slugFa" TEXT NOT NULL,
    "slugEn" TEXT,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "descriptionFa" TEXT,
    "descriptionEn" TEXT,
    "metaTitleFa" TEXT,
    "metaTitleEn" TEXT,
    "metaDescriptionFa" TEXT,
    "metaDescriptionEn" TEXT,
    "ogImageId" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "changefreq" TEXT NOT NULL DEFAULT 'monthly',
    "focusKeyword" TEXT,
    "jsonLdOverride" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "slugFa" TEXT NOT NULL,
    "slugEn" TEXT,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "descriptionFa" TEXT,
    "descriptionEn" TEXT,
    "benefitsFa" TEXT,
    "benefitsEn" TEXT,
    "durationFa" TEXT,
    "durationEn" TEXT,
    "priceFrom" INTEGER,
    "priceTo" INTEGER,
    "priceNoteFa" TEXT,
    "priceNoteEn" TEXT,
    "metaTitleFa" TEXT,
    "metaTitleEn" TEXT,
    "metaDescriptionFa" TEXT,
    "metaDescriptionEn" TEXT,
    "ogImageId" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "changefreq" TEXT NOT NULL DEFAULT 'monthly',
    "focusKeyword" TEXT,
    "jsonLdOverride" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "titleFa" TEXT,
    "titleEn" TEXT,
    "specialtyFa" TEXT,
    "specialtyEn" TEXT,
    "bioFa" TEXT,
    "bioEn" TEXT,
    "photoId" TEXT,
    "licenseNo" TEXT,
    "socials" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Specialty" (
    "id" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingHour" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkingHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "issuerFa" TEXT,
    "issuerEn" TEXT,
    "year" INTEGER,
    "imageId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "descriptionFa" TEXT,
    "descriptionEn" TEXT,
    "imageId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Species" (
    "id" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Breed" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "slugFa" TEXT NOT NULL,
    "slugEn" TEXT,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "originFa" TEXT,
    "originEn" TEXT,
    "sizeFa" TEXT,
    "sizeEn" TEXT,
    "weightRangeFa" TEXT,
    "weightRangeEn" TEXT,
    "lifespanFa" TEXT,
    "lifespanEn" TEXT,
    "temperamentFa" TEXT,
    "temperamentEn" TEXT,
    "groomingNeedsFa" TEXT,
    "groomingNeedsEn" TEXT,
    "commonHealthIssuesFa" TEXT,
    "commonHealthIssuesEn" TEXT,
    "imageId" TEXT,
    "metaTitleFa" TEXT,
    "metaTitleEn" TEXT,
    "metaDescriptionFa" TEXT,
    "metaDescriptionEn" TEXT,
    "ogImageId" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "changefreq" TEXT NOT NULL DEFAULT 'monthly',
    "focusKeyword" TEXT,
    "jsonLdOverride" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Breed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedCareGuide" (
    "id" TEXT NOT NULL,
    "breedId" TEXT NOT NULL,
    "titleFa" TEXT NOT NULL,
    "titleEn" TEXT,
    "contentFa" TEXT,
    "contentEn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedCareGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "slugFa" TEXT NOT NULL,
    "slugEn" TEXT,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "descriptionFa" TEXT,
    "descriptionEn" TEXT,
    "imageId" TEXT,
    "metaTitleFa" TEXT,
    "metaTitleEn" TEXT,
    "metaDescriptionFa" TEXT,
    "metaDescriptionEn" TEXT,
    "ogImageId" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "changefreq" TEXT NOT NULL DEFAULT 'weekly',
    "focusKeyword" TEXT,
    "jsonLdOverride" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "slugFa" TEXT NOT NULL,
    "slugEn" TEXT,
    "logoId" TEXT,
    "descriptionFa" TEXT,
    "descriptionEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "brandId" TEXT,
    "sku" TEXT,
    "slugFa" TEXT NOT NULL,
    "slugEn" TEXT,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "shortDescFa" TEXT,
    "shortDescEn" TEXT,
    "descriptionFa" TEXT,
    "descriptionEn" TEXT,
    "price" INTEGER NOT NULL,
    "comparePrice" INTEGER,
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'OUT_OF_STOCK',
    "isPurchasable" BOOLEAN NOT NULL DEFAULT false,
    "weight" DOUBLE PRECISION,
    "dimensions" TEXT,
    "badges" JSONB,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "metaTitleFa" TEXT,
    "metaTitleEn" TEXT,
    "metaDescriptionFa" TEXT,
    "metaDescriptionEn" TEXT,
    "ogImageId" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "changefreq" TEXT NOT NULL DEFAULT 'daily',
    "focusKeyword" TEXT,
    "jsonLdOverride" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "price" INTEGER,
    "comparePrice" INTEGER,
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'OUT_OF_STOCK',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttribute" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "valueFa" TEXT NOT NULL,
    "valueEn" TEXT,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostCategory" (
    "id" TEXT NOT NULL,
    "slugFa" TEXT NOT NULL,
    "slugEn" TEXT,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PostCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slugFa" TEXT NOT NULL,
    "slugEn" TEXT,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Author" (
    "id" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "bioFa" TEXT,
    "bioEn" TEXT,
    "avatarId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "authorId" TEXT,
    "slugFa" TEXT NOT NULL,
    "slugEn" TEXT,
    "titleFa" TEXT NOT NULL,
    "titleEn" TEXT,
    "excerptFa" TEXT,
    "excerptEn" TEXT,
    "contentFa" TEXT,
    "contentEn" TEXT,
    "readingTime" INTEGER,
    "imageId" TEXT,
    "metaTitleFa" TEXT,
    "metaTitleEn" TEXT,
    "metaDescriptionFa" TEXT,
    "metaDescriptionEn" TEXT,
    "ogImageId" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "changefreq" TEXT NOT NULL DEFAULT 'monthly',
    "focusKeyword" TEXT,
    "jsonLdOverride" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTag" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE "FaqCategory" (
    "id" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "serviceId" TEXT,
    "questionFa" TEXT NOT NULL,
    "questionEn" TEXT,
    "answerFa" TEXT NOT NULL,
    "answerEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "contentFa" TEXT NOT NULL,
    "contentEn" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "avatarId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryAlbum" (
    "id" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryImage" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "captionFa" TEXT,
    "captionEn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "titleFa" TEXT,
    "titleEn" TEXT,
    "subtitleFa" TEXT,
    "subtitleEn" TEXT,
    "linkUrl" TEXT,
    "imageId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "slugFa" TEXT NOT NULL,
    "slugEn" TEXT,
    "titleFa" TEXT NOT NULL,
    "titleEn" TEXT,
    "contentFa" TEXT,
    "contentEn" TEXT,
    "metaTitleFa" TEXT,
    "metaTitleEn" TEXT,
    "metaDescriptionFa" TEXT,
    "metaDescriptionEn" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "slugFa" TEXT NOT NULL,
    "slugEn" TEXT,
    "titleFa" TEXT NOT NULL,
    "titleEn" TEXT,
    "contentFa" TEXT,
    "contentEn" TEXT,
    "metaTitleFa" TEXT,
    "metaTitleEn" TEXT,
    "metaDescriptionFa" TEXT,
    "metaDescriptionEn" TEXT,
    "ogImageId" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "changefreq" TEXT NOT NULL DEFAULT 'monthly',
    "focusKeyword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fa-IR',
    "volume" INTEGER,
    "difficulty" INTEGER,
    "mappedUrl" TEXT,
    "priority" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "petType" TEXT,
    "serviceInterest" TEXT,
    "message" TEXT,
    "source" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCamp" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "referrer" TEXT,
    "landingPage" TEXT,
    "notes" TEXT,
    "assignedTo" TEXT,
    "followUpDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentRequest" (
    "id" TEXT NOT NULL,
    "patientName" TEXT,
    "phone" TEXT NOT NULL,
    "serviceId" TEXT,
    "preferredDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentSlot" (
    "id" TEXT NOT NULL,
    "vetId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetOwner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "breedId" TEXT,
    "age" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalRecord" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "vetId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diagnosis" TEXT NOT NULL,
    "treatment" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaccinationRecord" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "dateGiven" TIMESTAMP(3) NOT NULL,
    "nextDueDate" TIMESTAMP(3),
    "vetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaccinationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurhash" TEXT,
    "altFa" TEXT NOT NULL,
    "altEn" TEXT,
    "caption" TEXT,
    "folderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RelatedServices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RelatedServices_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_SpeciesProducts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SpeciesProducts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permissionId_key" ON "RolePermission"("role", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorToken_token_key" ON "TwoFactorToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorToken_email_token_key" ON "TwoFactorToken"("email", "token");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_idx" ON "LoginAttempt"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SocialLink_platform_key" ON "SocialLink"("platform");

-- CreateIndex
CREATE INDEX "SocialLink_isActive_sortOrder_idx" ON "SocialLink"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ContactChannel_isActive_sortOrder_idx" ON "ContactChannel"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "NavigationMenu_name_key" ON "NavigationMenu"("name");

-- CreateIndex
CREATE INDEX "MenuItem_menuId_idx" ON "MenuItem"("menuId");

-- CreateIndex
CREATE INDEX "MenuItem_parentId_idx" ON "MenuItem"("parentId");

-- CreateIndex
CREATE INDEX "MenuItem_isActive_sortOrder_idx" ON "MenuItem"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Redirect_source_key" ON "Redirect"("source");

-- CreateIndex
CREATE INDEX "Redirect_source_idx" ON "Redirect"("source");

-- CreateIndex
CREATE INDEX "Announcement_isActive_sortOrder_idx" ON "Announcement"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Theme_name_key" ON "Theme"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ThemePreset_name_key" ON "ThemePreset"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserThemePreference_userId_key" ON "UserThemePreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Division_slugFa_key" ON "Division"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "Division_slugEn_key" ON "Division"("slugEn");

-- CreateIndex
CREATE INDEX "Division_slugFa_idx" ON "Division"("slugFa");

-- CreateIndex
CREATE INDEX "Division_isActive_sortOrder_idx" ON "Division"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ServiceCategory_isActive_sortOrder_idx" ON "ServiceCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slugFa_key" ON "Service"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slugEn_key" ON "Service"("slugEn");

-- CreateIndex
CREATE INDEX "Service_divisionId_idx" ON "Service"("divisionId");

-- CreateIndex
CREATE INDEX "Service_slugFa_idx" ON "Service"("slugFa");

-- CreateIndex
CREATE INDEX "Service_isActive_sortOrder_idx" ON "Service"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "StaffMember_isActive_sortOrder_idx" ON "StaffMember"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Certificate_isActive_sortOrder_idx" ON "Certificate"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Facility_isActive_sortOrder_idx" ON "Facility"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Species_isActive_sortOrder_idx" ON "Species"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Breed_slugFa_key" ON "Breed"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "Breed_slugEn_key" ON "Breed"("slugEn");

-- CreateIndex
CREATE INDEX "Breed_speciesId_idx" ON "Breed"("speciesId");

-- CreateIndex
CREATE INDEX "Breed_slugFa_idx" ON "Breed"("slugFa");

-- CreateIndex
CREATE INDEX "Breed_isActive_sortOrder_idx" ON "Breed"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "BreedCareGuide_breedId_idx" ON "BreedCareGuide"("breedId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slugFa_key" ON "ProductCategory"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slugEn_key" ON "ProductCategory"("slugEn");

-- CreateIndex
CREATE INDEX "ProductCategory_parentId_idx" ON "ProductCategory"("parentId");

-- CreateIndex
CREATE INDEX "ProductCategory_slugFa_idx" ON "ProductCategory"("slugFa");

-- CreateIndex
CREATE INDEX "ProductCategory_isActive_sortOrder_idx" ON "ProductCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slugFa_key" ON "Brand"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slugEn_key" ON "Brand"("slugEn");

-- CreateIndex
CREATE INDEX "Brand_slugFa_idx" ON "Brand"("slugFa");

-- CreateIndex
CREATE INDEX "Brand_isActive_sortOrder_idx" ON "Brand"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slugFa_key" ON "Product"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slugEn_key" ON "Product"("slugEn");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_slugFa_idx" ON "Product"("slugFa");

-- CreateIndex
CREATE INDEX "Product_isActive_sortOrder_idx" ON "Product"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductAttribute_productId_idx" ON "ProductAttribute"("productId");

-- CreateIndex
CREATE INDEX "Inventory_productId_idx" ON "Inventory"("productId");

-- CreateIndex
CREATE INDEX "Wishlist_userId_idx" ON "Wishlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_userId_productId_key" ON "Wishlist"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "PostCategory_slugFa_key" ON "PostCategory"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "PostCategory_slugEn_key" ON "PostCategory"("slugEn");

-- CreateIndex
CREATE INDEX "PostCategory_slugFa_idx" ON "PostCategory"("slugFa");

-- CreateIndex
CREATE INDEX "PostCategory_isActive_sortOrder_idx" ON "PostCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slugFa_key" ON "Tag"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slugEn_key" ON "Tag"("slugEn");

-- CreateIndex
CREATE INDEX "Tag_slugFa_idx" ON "Tag"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slugFa_key" ON "Post"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slugEn_key" ON "Post"("slugEn");

-- CreateIndex
CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");

-- CreateIndex
CREATE INDEX "Post_slugFa_idx" ON "Post"("slugFa");

-- CreateIndex
CREATE INDEX "Post_isActive_idx" ON "Post"("isActive");

-- CreateIndex
CREATE INDEX "FaqCategory_isActive_sortOrder_idx" ON "FaqCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Faq_categoryId_idx" ON "Faq"("categoryId");

-- CreateIndex
CREATE INDEX "Faq_serviceId_idx" ON "Faq"("serviceId");

-- CreateIndex
CREATE INDEX "Faq_isActive_sortOrder_idx" ON "Faq"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Testimonial_isActive_sortOrder_idx" ON "Testimonial"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "GalleryAlbum_isActive_sortOrder_idx" ON "GalleryAlbum"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "GalleryImage_albumId_idx" ON "GalleryImage"("albumId");

-- CreateIndex
CREATE INDEX "GalleryImage_isActive_sortOrder_idx" ON "GalleryImage"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Banner_isActive_sortOrder_idx" ON "Banner"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_slugFa_key" ON "LandingPage"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_slugEn_key" ON "LandingPage"("slugEn");

-- CreateIndex
CREATE INDEX "LandingPage_slugFa_idx" ON "LandingPage"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "Page_slugFa_key" ON "Page"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "Page_slugEn_key" ON "Page"("slugEn");

-- CreateIndex
CREATE INDEX "Page_slugFa_idx" ON "Page"("slugFa");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_term_locale_key" ON "Keyword"("term", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PetOwner_phone_key" ON "PetOwner"("phone");

-- CreateIndex
CREATE INDEX "Pet_ownerId_idx" ON "Pet"("ownerId");

-- CreateIndex
CREATE INDEX "MedicalRecord_petId_idx" ON "MedicalRecord"("petId");

-- CreateIndex
CREATE INDEX "VaccinationRecord_petId_idx" ON "VaccinationRecord"("petId");

-- CreateIndex
CREATE INDEX "MediaFolder_parentId_idx" ON "MediaFolder"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Media_key_key" ON "Media"("key");

-- CreateIndex
CREATE INDEX "Media_folderId_idx" ON "Media"("folderId");

-- CreateIndex
CREATE INDEX "_RelatedServices_B_index" ON "_RelatedServices"("B");

-- CreateIndex
CREATE INDEX "_SpeciesProducts_B_index" ON "_SpeciesProducts"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_email_fkey" FOREIGN KEY ("email") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "NavigationMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Breed" ADD CONSTRAINT "Breed_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedCareGuide" ADD CONSTRAINT "BreedCareGuide_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PostCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FaqCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "GalleryAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "PetOwner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaFolder" ADD CONSTRAINT "MediaFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MediaFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "MediaFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RelatedServices" ADD CONSTRAINT "_RelatedServices_A_fkey" FOREIGN KEY ("A") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RelatedServices" ADD CONSTRAINT "_RelatedServices_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SpeciesProducts" ADD CONSTRAINT "_SpeciesProducts_A_fkey" FOREIGN KEY ("A") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SpeciesProducts" ADD CONSTRAINT "_SpeciesProducts_B_fkey" FOREIGN KEY ("B") REFERENCES "Species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

