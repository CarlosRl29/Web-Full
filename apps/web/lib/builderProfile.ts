/**
 * UI-safe profile type for RoutineBuilder and related components.
 * Handles API response shape variations (snake_case vs camelCase) and null-safety.
 */
export type BuilderProfile = {
  weightKg: number | null;
  heightCm: number | null;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  goal: string | null;
  daysPerWeek: number | null;
  equipment: string[];
  bodyFatPct: number | null;
  age: number | null;
  injuries: string | null;
  sessionMinutes: number | null;
};

export function mapMeToBuilderProfile(me: unknown): BuilderProfile {
  const m = me && typeof me === "object" ? (me as Record<string, unknown>) : {};
  const num = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string | null =>
    v != null && typeof v === "string" ? v : null;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  return {
    weightKg: num(m.weight_kg ?? m.weightKg),
    heightCm: num(m.height_cm ?? m.heightCm),
    sex: (m.sex === "MALE" || m.sex === "FEMALE" ? m.sex : "UNKNOWN") as BuilderProfile["sex"],
    experienceLevel:
      m.experience_level === "BEGINNER" ||
      m.experience_level === "INTERMEDIATE" ||
      m.experience_level === "ADVANCED"
        ? (m.experience_level as BuilderProfile["experienceLevel"])
        : m.experienceLevel === "BEGINNER" ||
            m.experienceLevel === "INTERMEDIATE" ||
            m.experienceLevel === "ADVANCED"
          ? (m.experienceLevel as BuilderProfile["experienceLevel"])
          : "BEGINNER",
    goal: str(m.goal) ?? null,
    daysPerWeek: num(m.days_per_week ?? m.daysPerWeek),
    equipment: arr(m.equipment),
    bodyFatPct: num(m.body_fat_pct ?? m.bodyFatPct),
    age: num(m.age),
    injuries: str(m.injuries),
    sessionMinutes: num(m.session_minutes ?? m.sessionMinutes)
  };
}

/** Convert BuilderProfile to GenerateRoutineModal defaultProfile shape (snake_case) */
export function builderProfileToDefaultProfile(
  bp: BuilderProfile | null
): {
  goal?: string;
  experience_level?: string;
  days_per_week?: number;
  equipment?: string[];
  weight_kg?: number | null;
  height_cm?: number | null;
  body_fat_pct?: number | null;
  age?: number | null;
  injuries?: string | null;
} | undefined {
  if (!bp) return undefined;
  return {
    goal: bp.goal ?? undefined,
    experience_level: bp.experienceLevel,
    days_per_week: bp.daysPerWeek ?? undefined,
    equipment: bp.equipment.length > 0 ? bp.equipment : undefined,
    weight_kg: bp.weightKg,
    height_cm: bp.heightCm,
    body_fat_pct: bp.bodyFatPct,
    age: bp.age,
    injuries: bp.injuries ?? undefined
  };
}
