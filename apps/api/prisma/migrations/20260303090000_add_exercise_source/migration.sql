-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';
