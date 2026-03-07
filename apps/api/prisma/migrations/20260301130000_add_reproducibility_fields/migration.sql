-- AlterTable
ALTER TABLE "AiRoutineGenerationLog" ADD COLUMN "seed_used" TEXT;
ALTER TABLE "AiRoutineGenerationLog" ADD COLUMN "exercise_library_hash" TEXT;
ALTER TABLE "AiRoutineGenerationLog" ADD COLUMN "knowledge_pack_version" TEXT;
