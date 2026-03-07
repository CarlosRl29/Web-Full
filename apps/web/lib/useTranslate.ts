"use client";

import { useCallback, useRef } from "react";
import { useLanguage } from "../components/LanguageProvider";

const CACHE_KEY = "axion-translations";
const MAX_CHARS = 450;

function getCache(): Map<string, string> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      return new Map(JSON.parse(raw));
    }
  } catch {
    // ignore
  }
  return new Map();
}

function saveCache(map: Map<string, string>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify([...map]));
  } catch {
    // ignore
  }
}

async function translateChunk(text: string): Promise<string> {
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`
  );
  const data = await res.json();
  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return data.responseData.translatedText;
  }
  return text;
}

function splitForTranslation(text: string): string[] {
  const chunks: string[] = [];
  const parts = text.split(/(?=Step:\d+)/i);
  let current = "";

  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    if (current.length + p.length + 2 > MAX_CHARS && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

export function useTranslate() {
  const { locale } = useLanguage();
  const cacheRef = useRef<Map<string, string>>(getCache());

  const translate = useCallback(
    async (text: string | null | undefined): Promise<string> => {
      if (!text?.trim()) return text ?? "";
      if (locale !== "es") return text;

      const trimmed = text.trim();
      const cache = cacheRef.current;
      const cached = cache.get(trimmed);
      if (cached) return cached;

      const chunks = splitForTranslation(trimmed);
      const results: string[] = [];

      for (const chunk of chunks) {
        const smallCached = cache.get(chunk);
        if (smallCached) {
          results.push(smallCached);
          continue;
        }
        try {
          const translated = await translateChunk(chunk);
          results.push(translated);
          cache.set(chunk, translated);
        } catch {
          results.push(chunk);
        }
      }

      const result = results.join("\n\n");
      cache.set(trimmed, result);
      saveCache(cache);
      return result;
    },
    [locale]
  );

  return { translate, locale };
}
