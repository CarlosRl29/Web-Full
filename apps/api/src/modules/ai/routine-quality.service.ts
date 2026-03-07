/**
 * Routine quality scoring.
 * Scores draft routines on training-science criteria.
 */

import { Injectable } from "@nestjs/common";
import type { AiRoutineDraft } from "@gym/shared";
import type { UserContext } from "./routine-rules";
import type { ExerciseLibraryItem } from "./exercise-library.service";

export type QualityScoreResult = {
  score: number;
  reasons: string[];
};

/** Volume targets per muscle group per week (sets) */
const VOLUME_TARGETS: Record<string, { min: number; max: number }> = {
  BEGINNER: { min: 6, max: 14 },
  INTERMEDIATE: { min: 10, max: 20 },
  ADVANCED: { min: 14, max: 25 }
};

/** Max sets per muscle per session */
const MAX_SETS_PER_MUSCLE_PER_SESSION = 10;

/** Push muscle keywords */
const PUSH_KEYWORDS = [
  "chest", "pectoral", "pecho", "shoulder", "hombro", "deltoid",
  "tricep", "tríceps", "press", "push"
];

/** Pull muscle keywords */
const PULL_KEYWORDS = [
  "back", "espalda", "lat", "dorsal", "bicep", "bíceps",
  "trapezius", "trapecio", "row", "pull", "remo"
];

/** Knee-dominant keywords */
const KNEE_KEYWORDS = [
  "squat", "sentadilla", "lunge", "zancada", "leg press",
  "prensa", "extension", "cuádriceps", "quadriceps"
];

/** Hip-hinge keywords */
const HINGE_KEYWORDS = [
  "deadlift", "peso muerto", "rdl", "romanian", "hip hinge",
  "hamstring", "isquiotibial", "good morning", "glute"
];

function classifyExercise(
  ex: ExerciseLibraryItem
): { push: boolean; pull: boolean; knee: boolean; hinge: boolean } {
  const mg = (ex.muscle_group ?? "").toLowerCase();
  const name = (ex.name ?? "").toLowerCase();
  const combined = `${mg} ${name}`;

  const push = PUSH_KEYWORDS.some((k) => combined.includes(k));
  const pull = PULL_KEYWORDS.some((k) => combined.includes(k));
  const knee = KNEE_KEYWORDS.some((k) => combined.includes(k));
  const hinge = HINGE_KEYWORDS.some((k) => combined.includes(k));

  return { push, pull, knee, hinge };
}

function getMuscleGroupKey(muscleGroup: string): string {
  const m = muscleGroup.toLowerCase();
  if (m.includes("chest") || m.includes("pectoral") || m.includes("pecho")) return "chest";
  if (m.includes("back") || m.includes("lat") || m.includes("espalda")) return "back";
  if (m.includes("shoulder") || m.includes("deltoid") || m.includes("hombro")) return "shoulders";
  if (m.includes("tricep") || m.includes("tríceps")) return "triceps";
  if (m.includes("bicep") || m.includes("bíceps")) return "biceps";
  if (m.includes("quad") || m.includes("cuádriceps") || m.includes("thigh")) return "quads";
  if (m.includes("hamstring") || m.includes("isquiotibial")) return "hamstrings";
  if (m.includes("glute") || m.includes("glúteo")) return "glutes";
  if (m.includes("calf") || m.includes("gemelo")) return "calves";
  return "other";
}

@Injectable()
export class RoutineQualityService {
  /** Score routine 0-100. Returns score and reasons (issues or positives). */
  scoreRoutine(
    draft: AiRoutineDraft,
    userContext: UserContext,
    library: ExerciseLibraryItem[]
  ): QualityScoreResult {
    const reasons: string[] = [];
    let totalScore = 0;
    const maxPerCriterion = 20;
    const criteriaCount = 5;

    const libMap = new Map(library.map((e) => [e.id, e]));

    const volumeTarget = VOLUME_TARGETS[userContext.experienceLevel] ?? VOLUME_TARGETS.INTERMEDIATE;
    const muscleSets: Record<string, number> = {};
    const muscleSessions: Record<string, Record<number, number>> = {};

    let pushSets = 0;
    let pullSets = 0;
    let kneeSets = 0;
    let hingeSets = 0;
    const uniqueExercises = new Set<string>();
    let totalExercises = 0;
    const setsPerMusclePerSession: Record<string, number> = {};
    let overloadViolations = 0;

    for (let dayIdx = 0; dayIdx < draft.days.length; dayIdx++) {
      const day = draft.days[dayIdx];
      const sessionSets: Record<string, number> = {};

      for (const group of day.groups) {
        for (const ex of group.exercises) {
          const item = libMap.get(ex.exercise_id);
          if (!item) continue;

          const sets = ex.target_sets_per_round * (group.rounds_total ?? 1);
          totalExercises++;
          uniqueExercises.add(ex.exercise_id);

          const mgKey = getMuscleGroupKey(item.muscle_group);
          muscleSets[mgKey] = (muscleSets[mgKey] ?? 0) + sets;
          sessionSets[mgKey] = (sessionSets[mgKey] ?? 0) + sets;

          const { push, pull, knee, hinge } = classifyExercise(item);
          if (push) pushSets += sets;
          if (pull) pullSets += sets;
          if (knee) kneeSets += sets;
          if (hinge) hingeSets += sets;

        }
      }

      for (const s of Object.values(sessionSets)) {
        if (s > MAX_SETS_PER_MUSCLE_PER_SESSION) {
          overloadViolations++;
        }
      }
    }

    const totalWeeklySets = Object.values(muscleSets).reduce((a, b) => a + b, 0);
    const daysPerWeek = draft.days.length;

    let volumeIssues = 0;
    for (const [mg, sets] of Object.entries(muscleSets)) {
      if (mg === "other") continue;
      if (sets < volumeTarget.min) {
        volumeIssues++;
        reasons.push(`Volume bajo para ${mg}: ${sets} sets/semana (mín ${volumeTarget.min})`);
      } else if (sets > volumeTarget.max) {
        volumeIssues++;
        reasons.push(`Volume alto para ${mg}: ${sets} sets/semana (máx ${volumeTarget.max})`);
      }
    }
    const volumeCriterionScore = volumeIssues === 0 ? maxPerCriterion : Math.max(0, maxPerCriterion - volumeIssues * 5);
    totalScore += volumeCriterionScore;

    const pushPullRatio = pushSets > 0 ? pullSets / pushSets : 1;
    const pushPullTarget = 0.8;
    const pushPullDiff = Math.abs(pushPullRatio - pushPullTarget);
    const pushPullScore = pushPullDiff <= 0.3 ? maxPerCriterion : Math.max(0, maxPerCriterion - Math.floor(pushPullDiff * 30));
    totalScore += pushPullScore;
    if (pushPullDiff > 0.3) {
      reasons.push(`Desequilibrio push/pull: ratio ${pushPullRatio.toFixed(2)} (objetivo ~${pushPullTarget})`);
    }

    const legSets = kneeSets + hingeSets;
    const kneeHingeRatio = legSets > 0 ? kneeSets / legSets : 0.5;
    const kneeHingeTarget = 0.5;
    const kneeHingeDiff = Math.abs(kneeHingeRatio - kneeHingeTarget);
    const kneeHingeScore = kneeHingeDiff <= 0.25 ? maxPerCriterion : Math.max(0, maxPerCriterion - Math.floor(kneeHingeDiff * 40));
    totalScore += kneeHingeScore;
    if (kneeHingeDiff > 0.25 && legSets > 0) {
      reasons.push(`Desequilibrio rodilla/cadera: ${(kneeHingeRatio * 100).toFixed(0)}% knee vs ${((1 - kneeHingeRatio) * 100).toFixed(0)}% hinge`);
    }

    const overloadScore = overloadViolations === 0 ? maxPerCriterion : Math.max(0, maxPerCriterion - overloadViolations * 5);
    totalScore += overloadScore;
    if (overloadViolations > 0) {
      reasons.push(`Sobrecarga por sesión: ${overloadViolations} músculo(s) exceden ${MAX_SETS_PER_MUSCLE_PER_SESSION} sets/sesión`);
    }

    const varietyRatio = totalExercises > 0 ? uniqueExercises.size / totalExercises : 1;
    const varietyScore = varietyRatio >= 0.9 ? maxPerCriterion : Math.floor(varietyRatio * maxPerCriterion);
    totalScore += varietyScore;
    if (varietyRatio < 0.8) {
      reasons.push(`Poca variedad: ${uniqueExercises.size} ejercicios únicos de ${totalExercises} total`);
    }

    const finalScore = Math.round(Math.min(100, totalScore));
    if (finalScore >= 80) {
      reasons.unshift(`Calidad buena: ${finalScore}/100`);
    } else if (finalScore < 70) {
      reasons.unshift(`Calidad insuficiente: ${finalScore}/100 (mínimo 70)`);
    }

    return { score: finalScore, reasons };
  }
}
