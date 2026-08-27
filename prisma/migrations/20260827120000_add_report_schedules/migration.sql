-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('report', 'revenue_reminder');

-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('weekly', 'monthly');

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL DEFAULT 'report',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "ReportFrequency" NOT NULL DEFAULT 'weekly',
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "hour" INTEGER NOT NULL DEFAULT 8,
    "minute" INTEGER NOT NULL DEFAULT 0,
    "rangePreset" TEXT NOT NULL DEFAULT 'last7',
    "propertyCode" TEXT,
    "recipients" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);
