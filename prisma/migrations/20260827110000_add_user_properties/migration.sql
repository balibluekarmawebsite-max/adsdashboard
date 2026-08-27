-- CreateTable
CREATE TABLE "user_properties" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,

    CONSTRAINT "user_properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_properties_userId_idx" ON "user_properties"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_properties_userId_propertyId_key" ON "user_properties"("userId", "propertyId");

-- AddForeignKey
ALTER TABLE "user_properties" ADD CONSTRAINT "user_properties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_properties" ADD CONSTRAINT "user_properties_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
