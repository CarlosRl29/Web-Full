-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('es', 'en');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN "canonical_slug" TEXT;

-- CreateTable
CREATE TABLE "ExerciseTranslation" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "short_description" TEXT,
    "technique_steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "common_mistakes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseTranslation_exercise_id_locale_key" ON "ExerciseTranslation"("exercise_id", "locale");
CREATE INDEX "ExerciseTranslation_exercise_id_idx" ON "ExerciseTranslation"("exercise_id");
CREATE UNIQUE INDEX "Exercise_canonical_slug_key" ON "Exercise"("canonical_slug");

-- AddForeignKey
ALTER TABLE "ExerciseTranslation" ADD CONSTRAINT "ExerciseTranslation_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
