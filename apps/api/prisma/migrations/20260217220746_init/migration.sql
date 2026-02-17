-- CreateTable
CREATE TABLE "AiRecommendationLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "coach_id" TEXT,
    "request_payload" JSONB NOT NULL,
    "response_payload" JSONB NOT NULL,
    "safety_flags" TEXT[],
    "model_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRecommendationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiRecommendationLog_user_id_created_at_idx" ON "AiRecommendationLog"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "AiRecommendationLog_coach_id_created_at_idx" ON "AiRecommendationLog"("coach_id", "created_at");

-- AddForeignKey
ALTER TABLE "AiRecommendationLog" ADD CONSTRAINT "AiRecommendationLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRecommendationLog" ADD CONSTRAINT "AiRecommendationLog_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
