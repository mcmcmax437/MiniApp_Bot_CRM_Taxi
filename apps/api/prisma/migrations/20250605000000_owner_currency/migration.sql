-- Add per-owner currency preference (ISO 4217 code).
ALTER TABLE "Owner" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'UAH';
