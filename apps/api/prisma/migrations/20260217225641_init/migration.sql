-- AlterTable
ALTER TABLE "AiRecommendationLog" ADD COLUMN     "dedup_hit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latency_ms" INTEGER,
ADD COLUMN     "rate_limited" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AiAppliedSuggestion" (
    "id" TEXT NOT NULL,
    "ai_log_id" TEXT NOT NULL,
    "routine_id" TEXT NOT NULL,
    "routine_day_id" TEXT NOT NULL,
    "applied_by_user_id" TEXT NOT NULL,
    "applied_changes" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAppliedSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAppliedSuggestion_routine_id_routine_day_id_created_at_idx" ON "AiAppliedSuggestion"("routine_id", "routine_day_id", "created_at");

-- CreateIndex
CREATE INDEX "AiAppliedSuggestion_ai_log_id_created_at_idx" ON "AiAppliedSuggestion"("ai_log_id", "created_at");

-- AddForeignKey
ALTER TABLE "AiAppliedSuggestion" ADD CONSTRAINT "AiAppliedSuggestion_ai_log_id_fkey" FOREIGN KEY ("ai_log_id") REFERENCES "AiRecommendationLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAppliedSuggestion" ADD CONSTRAINT "AiAppliedSuggestion_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAppliedSuggestion" ADD CONSTRAINT "AiAppliedSuggestion_routine_day_id_fkey" FOREIGN KEY ("routine_day_id") REFERENCES "RoutineDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAppliedSuggestion" ADD CONSTRAINT "AiAppliedSuggestion_applied_by_user_id_fkey" FOREIGN KEY ("applied_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
