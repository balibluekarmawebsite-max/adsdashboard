-- CreateTable
CREATE TABLE "ai_summaries" (
    "id" TEXT NOT NULL,
    "filtersHash" TEXT NOT NULL,
    "periodFrom" DATE NOT NULL,
    "periodTo" DATE NOT NULL,
    "property" TEXT NOT NULL DEFAULT 'all',
    "platform" TEXT NOT NULL DEFAULT 'all',
    "language" TEXT NOT NULL DEFAULT 'en',
    "model" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "tokenUsage" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_summaries_filtersHash_idx" ON "ai_summaries"("filtersHash");

-- CreateIndex
CREATE INDEX "ai_summaries_generatedAt_idx" ON "ai_summaries"("generatedAt");
