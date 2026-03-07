-- AlterTable
ALTER TABLE "AiRoutineGenerationLog" ADD COLUMN "request_id" TEXT;
ALTER TABLE "AiRoutineGenerationLog" ADD COLUMN "failure_stage" TEXT;
ALTER TABLE "AiRoutineGenerationLog" ADD COLUMN "duration_ms" INTEGER;
ALTER TABLE "AiRoutineGenerationLog" ADD COLUMN "model_name" TEXT;
ALTER TABLE "AiRoutineGenerationLog" ADD COLUMN "prompt_chars" INTEGER;
ALTER TABLE "AiRoutineGenerationLog" ADD COLUMN "response_chars" INTEGER;

-- CreateIndex
CREATE INDEX "AiRoutineGenerationLog_request_id_idx" ON "AiRoutineGenerationLog"("request_id");
