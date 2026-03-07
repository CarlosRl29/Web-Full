/**
 * Data migration: Create ExerciseTranslation(en) for each Exercise, add canonical_slug.
 * Run after schema migration.
 *
 * Usage: npm run migrate-exercise-translations -w apps/api
 */

import { config } from "dotenv";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

config({ path: path.join(process.cwd(), ".env") });
if (!process.env.DATABASE_URL) {
  config({ path: path.join(process.cwd(), "../../.env") });
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

function ensureUniqueSlug(slug: string, existing: Set<string>): string {
  let candidate = slug || "exercise";
  let suffix = 0;
  while (existing.has(candidate)) {
    suffix++;
    candidate = `${slug}_${suffix}`;
  }
  existing.add(candidate);
  return candidate;
}

async function main() {
  const prisma = new PrismaClient();
  const exercises = await prisma.exercise.findMany({
    select: { id: true, name: true, canonical_slug: true },
    orderBy: { name: "asc" }
  });

  const existingSlugs = new Set<string>(
    (await prisma.exercise.findMany({ where: { canonical_slug: { not: null } }, select: { canonical_slug: true } }))
      .map((e) => e.canonical_slug!)
      .filter(Boolean)
  );

  let created = 0;
  let slugsUpdated = 0;

  for (const ex of exercises) {
    const hasEn = await prisma.exerciseTranslation.findUnique({
      where: { exercise_id_locale: { exercise_id: ex.id, locale: "en" } }
    });
    if (!hasEn) {
      await prisma.exerciseTranslation.create({
        data: {
          exercise_id: ex.id,
          locale: "en",
          name: ex.name
        }
      });
      created++;
    }

    if (!ex.canonical_slug) {
      const slug = ensureUniqueSlug(toSlug(ex.name), existingSlugs);
      await prisma.exercise.update({
        where: { id: ex.id },
        data: { canonical_slug: slug }
      });
      slugsUpdated++;
    }
  }

  console.log(`Created ${created} EN translations`);
  console.log(`Updated ${slugsUpdated} canonical_slugs`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
