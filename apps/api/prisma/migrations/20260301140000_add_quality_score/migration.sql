-- AlterTable
ALTER TABLE "AiRoutineGenerationLog" ADD COLUMN "quality_score" INTEGER;
ALTER TABLE "AiRoutineGenerationLog" ADD COLUMN "quality_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[];
