-- CreateTable
CREATE TABLE "campaign_routes" (
    "id" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "isRegex" BOOLEAN NOT NULL DEFAULT false,
    "propertyId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_routes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_routes_adAccountId_idx" ON "campaign_routes"("adAccountId");

-- AddForeignKey
ALTER TABLE "campaign_routes" ADD CONSTRAINT "campaign_routes_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_routes" ADD CONSTRAINT "campaign_routes_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
