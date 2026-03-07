-- CreateTable
CREATE TABLE "AiRoutineGenerationLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "generation_input" JSONB NOT NULL,
    "ai_output_raw" JSONB,
    "validation_errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "final_routine" JSONB,
    "routine_id" TEXT,
    "repair_attempts" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRoutineGenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiRoutineGenerationLog_user_id_created_at_idx" ON "AiRoutineGenerationLog"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "AiRoutineGenerationLog" ADD CONSTRAINT "AiRoutineGenerationLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRoutineGenerationLog" ADD CONSTRAINT "AiRoutineGenerationLog_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
