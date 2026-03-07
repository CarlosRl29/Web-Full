-- RAG logging fields for AiRoutineGenerationLog (no pgvector required)
ALTER TABLE "AiRoutineGenerationLog" ADD COLUMN "retrieved_sources" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AiRoutineGenerationLog" ADD COLUMN "retrieved_top_k" INTEGER;
