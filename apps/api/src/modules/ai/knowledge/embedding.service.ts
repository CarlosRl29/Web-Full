/**
 * Embedding service using OpenAI text-embedding-3-small (1536 dimensions).
 * Requires OPENAI_API_KEY environment variable.
 */

import { config } from "dotenv";
import * as path from "path";

if (!process.env.OPENAI_API_KEY) {
  config({ path: path.join(process.cwd(), ".env") });
  if (!process.env.OPENAI_API_KEY) {
    config({ path: path.join(process.cwd(), "../../.env") });
  }
}

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;

const INVALID_KEY_ERROR =
  "Invalid OpenAI API key format. Use a secret key that starts with 'sk-' and set it in apps/api/.env";

type KeyStatus = { valid: boolean; skip: boolean };

let _keyValidationLogged = false;

function validateApiKey(): KeyStatus {
  const raw = process.env.OPENAI_API_KEY;
  const keyPresent = !!raw?.trim();
  const keyPrefix = keyPresent ? raw!.slice(0, 3) : "(none)";
  if (!_keyValidationLogged) {
    console.log(`OpenAI API key: keyPresent=${keyPresent}, keyPrefix=${keyPrefix}`);
    _keyValidationLogged = true;
  }

  if (!keyPresent) {
    return { valid: false, skip: true };
  }
  const trimmed = raw!.trim();
  if (trimmed.includes("TU_KEY") || trimmed.startsWith("Tsk-")) {
    throw new Error(INVALID_KEY_ERROR);
  }
  if (!trimmed.startsWith("sk-")) {
    throw new Error(INVALID_KEY_ERROR);
  }
  return { valid: true, skip: false };
}

export async function embedText(text: string): Promise<number[]> {
  const status = validateApiKey();
  if (status.skip) {
    throw new Error("OPENAI_API_KEY is required for embeddings");
  }
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const res = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000)
  });
  const vec = res.data[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIM) {
    throw new Error(`Unexpected embedding shape: ${vec?.length ?? 0}`);
  }
  return vec;
}

export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const status = validateApiKey();
  if (status.skip) {
    console.warn("OPENAI_API_KEY missing: skipping embeddings generation. RAG retrieval will be disabled.");
    return texts.map(() => null);
  }
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const res = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts.map((t) => t.slice(0, 8000))
  });
  const sorted = [...res.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((d) => {
    const vec = d.embedding;
    if (!vec || vec.length !== EMBEDDING_DIM) {
      throw new Error(`Unexpected embedding shape: ${vec?.length ?? 0}`);
    }
    return vec;
  });
}

export { EMBEDDING_DIM };
