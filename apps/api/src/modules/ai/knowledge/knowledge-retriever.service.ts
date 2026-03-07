/**
 * RAG Knowledge Retriever - vector search over KnowledgeChunk.
 * Uses cosine distance; filters by document.version = knowledge_pack_version.
 */

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { embedText } from "./embedding.service";

export type RetrievedChunk = {
  content: string;
  source: string;
  score: number;
};

@Injectable()
export class KnowledgeRetrieverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieve topK chunks most relevant to the query.
   * Only uses chunks where document.version = knowledgePackVersion.
   */
  async retrieveRelevantChunks(
    query: string,
    knowledgePackVersion: string,
    topK = 8
  ): Promise<RetrievedChunk[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return [];
    }

    let queryEmbedding: number[];
    try {
      queryEmbedding = await embedText(query);
    } catch {
      return [];
    }

    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    let rows: Array<{ content: string; source: string; distance: number }>;
    try {
      rows = await this.prisma.$queryRawUnsafe<
      Array<{ content: string; source: string; distance: number }>
    >(
      `SELECT c.content, d.source, (c.embedding <=> $1::vector) AS distance
       FROM "KnowledgeChunk" c
       JOIN "KnowledgeDocument" d ON d.id = c.document_id
       WHERE d.version = $2 AND c.embedding IS NOT NULL
       ORDER BY c.embedding <=> $1::vector
       LIMIT $3`,
      embeddingStr,
      knowledgePackVersion,
      topK
    );
    } catch {
      return [];
    }

    return rows.map((r) => ({
      content: r.content,
      source: r.source,
      score: 1 - r.distance
    }));
  }
}
