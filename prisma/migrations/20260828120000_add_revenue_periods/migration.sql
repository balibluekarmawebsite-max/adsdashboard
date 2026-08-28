-- CreateTable
CREATE TABLE "revenue_periods" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "source" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "revenue_periods_propertyId_idx" ON "revenue_periods"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_periods_propertyId_startDate_endDate_key" ON "revenue_periods"("propertyId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "revenue_periods" ADD CONSTRAINT "revenue_periods_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
