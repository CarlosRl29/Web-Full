-- Add optional body metrics to support richer profile data.
ALTER TABLE "User"
ADD COLUMN "weight_kg" DOUBLE PRECISION,
ADD COLUMN "height_cm" INTEGER,
ADD COLUMN "body_fat_pct" DOUBLE PRECISION,
ADD COLUMN "age" INTEGER;
