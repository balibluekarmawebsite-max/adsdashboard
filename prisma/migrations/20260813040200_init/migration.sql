-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('google', 'meta');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('active', 'needs_reauth', 'error');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('running', 'success', 'error');

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_connections" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "accountRef" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'active',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_accounts" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,

    CONSTRAINT "ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics_daily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "propertyId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "conversions" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "conversionValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metrics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "adAccountId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'running',
    "rowsWritten" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "properties_code_key" ON "properties"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "platform_connections_platform_accountRef_key" ON "platform_connections"("platform", "accountRef");

-- CreateIndex
CREATE INDEX "ad_accounts_propertyId_idx" ON "ad_accounts"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_accounts_platform_externalAccountId_key" ON "ad_accounts"("platform", "externalAccountId");

-- CreateIndex
CREATE INDEX "metrics_daily_date_idx" ON "metrics_daily"("date");

-- CreateIndex
CREATE INDEX "metrics_daily_propertyId_idx" ON "metrics_daily"("propertyId");

-- CreateIndex
CREATE INDEX "metrics_daily_platform_idx" ON "metrics_daily"("platform");

-- CreateIndex
CREATE INDEX "metrics_daily_propertyId_date_idx" ON "metrics_daily"("propertyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "metrics_daily_date_platform_adAccountId_campaignId_key" ON "metrics_daily"("date", "platform", "adAccountId", "campaignId");

-- CreateIndex
CREATE INDEX "sync_logs_platform_startedAt_idx" ON "sync_logs"("platform", "startedAt");

-- AddForeignKey
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics_daily" ADD CONSTRAINT "metrics_daily_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics_daily" ADD CONSTRAINT "metrics_daily_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
