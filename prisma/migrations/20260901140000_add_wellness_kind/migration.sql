-- Add a "wellness" property kind (outlets like sound-healing under a hotel).
-- Postgres 12+ allows ADD VALUE outside a transaction-using context; the value
-- is only added here, never used in this same migration.
ALTER TYPE "PropertyKind" ADD VALUE IF NOT EXISTS 'wellness';
