/**
 * RAG Knowledge Ingestion Script
 * Reads /ai-knowledge/*.md, chunks, embeds, and upserts into KnowledgeDocument + KnowledgeChunk.
 *
 * Usage: npm run ai:ingest-knowledge
 * Requires: DATABASE_URL (OPENAI_API_KEY optional - without it, documents are stored without embeddings)
 * Version: KNOWLEDGE_PACK_VERSION or "unknown"
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { embedTexts } from "./embedding.service";

config({ path: path.join(process.cwd(), ".env") });
if (!process.env.DATABASE_URL) {
  config({ path: path.join(process.cwd(), "../../.env") });
}

const MAX_CHUNK_CHARS = 1500;
const MIN_CHUNK_CHARS = 200;

function findKnowledgeDir(): string {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "ai-knowledge"),
    path.join(cwd, "..", "ai-knowledge"),
    path.join(cwd, "..", "..", "ai-knowledge")
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      return dir;
    }
  }
  throw new Error(
    `ai-knowledge directory not found. Searched: ${candidates.join(", ")}`
  );
}

function chunkText(content: string): string[] {
  const chunks: string[] = [];
  const paragraphs = content.split(/\n\n+/);
  let current = "";

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 2 <= MAX_CHUNK_CHARS) {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    } else {
      if (current) {
        if (current.length > MAX_CHUNK_CHARS) {
          const parts = splitBySentences(current, MAX_CHUNK_CHARS);
          chunks.push(...parts);
        } else {
          chunks.push(current);
        }
        current = "";
      }
      if (trimmed.length > MAX_CHUNK_CHARS) {
        chunks.push(...splitBySentences(trimmed, MAX_CHUNK_CHARS));
      } else {
        current = trimmed;
      }
    }
  }
  if (current && current.length >= MIN_CHUNK_CHARS) {
    chunks.push(current);
  } else if (current) {
    if (chunks.length) chunks[chunks.length - 1] += `\n\n${current}`;
    else chunks.push(current);
  }
  return chunks.filter((c) => c.trim().length > 0);
}

function splitBySentences(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let current = "";
  for (const s of sentences) {
    if (current.length + s.length + 1 <= maxChars) {
      current = current ? `${current} ${s}` : s;
    } else {
      if (current) parts.push(current);
      current = s.length > maxChars ? s.slice(0, maxChars) : s;
    }
  }
  if (current) parts.push(current);
  return parts;
}

async function main() {
  const knowledgeDir = findKnowledgeDir();
  const version = process.env.KNOWLEDGE_PACK_VERSION ?? "unknown";
  const prisma = new PrismaClient();

  const files = fs
    .readdirSync(knowledgeDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(knowledgeDir, f));

  if (files.length === 0) {
    console.log("No .md files found in", knowledgeDir);
    process.exit(0);
  }

  console.log(`Ingesting ${files.length} files with version="${version}"`);

  const hasApiKey = !!process.env.OPENAI_API_KEY?.trim();
  if (!hasApiKey) {
    console.warn(
      "OPENAI_API_KEY missing: skipping embeddings generation. RAG retrieval will be disabled."
    );
  } else {
    console.log("Generating embeddings using OpenAI model: text-embedding-3-small");
  }

  let documentsCount = 0;
  let chunkCount = 0;

  for (const filePath of files) {
    const source = path.basename(filePath);
    const title = source.replace(/\.md$/, "").replace(/_/g, " ");
    const content = fs.readFileSync(filePath, "utf-8");
    const chunkTexts = chunkText(content);

    if (chunkTexts.length === 0) {
      console.log(`  Skip ${source}: no chunks`);
      continue;
    }

    console.log(`  ${source}: ${chunkTexts.length} chunks`);

    let embeddings: (number[] | null)[] = [];
    if (hasApiKey) {
      const BATCH = 100;
      for (let i = 0; i < chunkTexts.length; i += BATCH) {
        const batch = chunkTexts.slice(i, i + BATCH);
        embeddings.push(...(await embedTexts(batch)));
      }
    }

    const doc = await prisma.knowledgeDocument.upsert({
      where: {
        source_version: { source, version }
      },
      create: { title, source, version },
      update: { title }
    });

    await prisma.knowledgeChunk.deleteMany({
      where: { document_id: doc.id }
    });

    documentsCount++;
    chunkCount += chunkTexts.length;

    for (let i = 0; i < chunkTexts.length; i++) {
      const vec = embeddings[i];
      if (vec) {
        const embeddingStr = `[${vec.join(",")}]`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO "KnowledgeChunk" (id, document_id, chunk_index, content, embedding, tags, created_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4::vector, ARRAY[]::text[], NOW())`,
          doc.id,
          i,
          chunkTexts[i],
          embeddingStr
        );
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "KnowledgeChunk" (id, document_id, chunk_index, content, tags, created_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, ARRAY[]::text[], NOW())`,
          doc.id,
          i,
          chunkTexts[i]
        );
      }
    }
  }

  console.log("Knowledge ingestion complete");
  console.log(`Documents processed: ${documentsCount}`);
  console.log(`Chunks created: ${chunkCount}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
