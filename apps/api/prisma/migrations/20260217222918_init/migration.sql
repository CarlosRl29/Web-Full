-- AlterTable
ALTER TABLE "AiRecommendationLog" ADD COLUMN     "request_hash" TEXT;

-- CreateIndex
CREATE INDEX "AiRecommendationLog_request_hash_created_at_idx" ON "AiRecommendationLog"("request_hash", "created_at");
