-- CreateEnum
CREATE TYPE "PropertyKind" AS ENUM ('hotel', 'restaurant', 'spa');

-- AlterTable
-- Existing rows default to `hotel` with a null parent, so current hotel data is
-- untouched. Outlets (restaurant/spa) are added afterwards via `outlets:seed`.
ALTER TABLE "properties" ADD COLUMN     "kind" "PropertyKind" NOT NULL DEFAULT 'hotel',
ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "properties_parentId_idx" ON "properties"("parentId");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
