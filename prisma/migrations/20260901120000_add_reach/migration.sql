-- AlterTable: unique-people reach (populated from Meta; Google reports none).
ALTER TABLE "metrics_daily" ADD COLUMN "reach" INTEGER NOT NULL DEFAULT 0;
