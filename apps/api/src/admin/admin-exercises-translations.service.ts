import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as path from "path";
import * as fs from "fs";

type TranslationUpdate = {
  name?: string;
  short_description?: string | null;
  technique_steps?: string[];
  cues?: string[];
  common_mistakes?: string[];
};

@Injectable()
export class AdminExercisesTranslationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTranslations(locale?: "es" | "en") {
    const where = locale ? { locale: locale as "es" | "en" } : undefined;
    return this.prisma.exerciseTranslation.findMany({
      where,
      include: { exercise: { select: { id: true, name: true, canonical_slug: true } } },
      orderBy: [{ exercise: { name: "asc" } }]
    });
  }

  async bulkCreateMissingEs() {
    const mappingPath = path.join(process.cwd(), "scripts", "exercise-name-mapping-en-es.json");
    let mapping: Record<string, string> = {};
    if (fs.existsSync(mappingPath)) {
      mapping = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));
    }

    const exercises = await this.prisma.exercise.findMany({
      include: { translations: { where: { locale: "es" } } }
    });

    let created = 0;
    for (const ex of exercises) {
      const hasEs = ex.translations.some((t) => t.locale === "es");
      if (hasEs) continue;

      const enTranslation = await this.prisma.exerciseTranslation.findUnique({
        where: { exercise_id_locale: { exercise_id: ex.id, locale: "en" } }
      });
      const enName = enTranslation?.name ?? ex.name;
      const esName = mapping[enName] ?? enName;

      await this.prisma.exerciseTranslation.create({
        data: {
          exercise_id: ex.id,
          locale: "es",
          name: esName
        }
      });
      created++;
    }
    return { created };
  }

  async updateTranslation(id: string, data: TranslationUpdate) {
    return this.prisma.exerciseTranslation.update({
      where: { id },
      data
    });
  }
}
