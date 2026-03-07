-- Requires pgvector: run "CREATE EXTENSION IF NOT EXISTS vector;" if not installed
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeDocument_version_idx" ON "KnowledgeDocument"("version");
CREATE UNIQUE INDEX "KnowledgeDocument_source_version_key" ON "KnowledgeDocument"("source", "version");
CREATE INDEX "KnowledgeChunk_document_id_idx" ON "KnowledgeChunk"("document_id");

ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
