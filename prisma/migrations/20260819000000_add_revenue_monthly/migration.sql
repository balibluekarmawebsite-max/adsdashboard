-- CreateTable
CREATE TABLE "revenue_monthly" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "source" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "revenue_monthly_propertyId_year_month_key" ON "revenue_monthly"("propertyId", "year", "month");

-- CreateIndex
CREATE INDEX "revenue_monthly_propertyId_idx" ON "revenue_monthly"("propertyId");

-- AddForeignKey
ALTER TABLE "revenue_monthly" ADD CONSTRAINT "revenue_monthly_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
