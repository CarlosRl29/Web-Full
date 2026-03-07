import { Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { MuscleGroup } from "../exercises/exercise-types";
import { ExerciseSyncService } from "../exercises/exercise-sync.service";
import { ExercisesService } from "../exercises/exercises.service";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentUser } from "../common/current-user.decorator";
import { Roles } from "../common/roles.decorator";
import { AuthUser } from "../auth/auth.types";

@Controller("admin/exercises")
export class AdminExercisesSyncController {
  constructor(
    private readonly syncService: ExerciseSyncService,
    private readonly exercisesService: ExercisesService,
    private readonly prisma: PrismaService
  ) {}

  /** Admin classification list: paginated, with pending_only, search, primary_muscle filters */
  @Get()
  @Roles(UserRole.ADMIN)
  async list(
    @CurrentUser() _user: AuthUser,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("pending_only") pendingOnly?: string,
    @Query("search") search?: string,
    @Query("primary_muscle") primaryMuscle?: string,
    @Query("locale") locale?: "es" | "en"
  ) {
    const limitNum = Math.min(Math.max(parseInt(limit ?? "50", 10) || 50, 1), 100);
    const offsetNum = Math.max(parseInt(offset ?? "0", 10) || 0, 0);
    const pending = pendingOnly === "true" || pendingOnly === "1";
    const muscle = primaryMuscle as MuscleGroup | undefined;

    const listParams = {
      search: search?.trim() || undefined,
      limit: limitNum,
      offset: offsetNum,
      muscle,
      locale: (locale ?? "en") as "es" | "en",
      pending_only: pending
    };
    const data = await this.exercisesService.list(listParams);

    const countWhere: object[] = [];
    if (pending) countWhere.push({ OR: [{ primary_muscle: null }, { movement_pattern: null }] });
    if (muscle) countWhere.push({ primary_muscle: muscle });
    if (search?.trim()) {
      countWhere.push({
        OR: [
          { name: { contains: search.trim(), mode: "insensitive" as const } },
          { canonical_slug: { contains: search.trim(), mode: "insensitive" as const } }
        ]
      });
    }
    const total = await this.prisma.exercise.count({
      where: countWhere.length > 0 ? { AND: countWhere } : undefined
    });

    return { data, total, limit: limitNum, offset: offsetNum };
  }

  /** Debug: exercise stats (total, by muscle, top equipment) */
  @Get("stats")
  @Roles(UserRole.ADMIN)
  async stats(@CurrentUser() _user: AuthUser) {
    const total = await this.prisma.exercise.count();
    const byMuscle = await this.prisma.exercise.groupBy({
      by: ["primary_muscle"],
      where: { primary_muscle: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } }
    });
    const equipmentCounts = await this.prisma.exercise.groupBy({
      by: ["equipment"],
      where: { equipment: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 15
    });
    return {
      total,
      by_primary_muscle: Object.fromEntries(
        byMuscle.map((r) => [r.primary_muscle ?? "null", r._count.id])
      ),
      top_equipment: equipmentCounts.map((r) => ({ value: r.equipment, count: r._count.id }))
    };
  }

  /** Debug: top ranked exercises for a muscle */
  @Get("ranks")
  @Roles(UserRole.ADMIN)
  async ranks(
    @Query("muscle") muscle: MuscleGroup,
    @CurrentUser() _user: AuthUser
  ) {
    const validMuscles: MuscleGroup[] = [
      "CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS", "QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE"
    ];
    const m = muscle && validMuscles.includes(muscle) ? muscle : "CHEST";
    const rows = await this.prisma.exerciseMuscleRank.findMany({
      where: { muscle: m },
      orderBy: { rank: "asc" },
      take: 20,
      include: { exercise: { select: { name: true, canonical_slug: true } } }
    });
    return rows.map((r) => ({
      rank: r.rank,
      name: r.exercise.name,
      canonical_slug: r.exercise.canonical_slug
    }));
  }

  /** Delete all exercises. Use before re-syncing. */
  @Delete("clear")
  @Roles(UserRole.ADMIN)
  async clearAll(@CurrentUser() _user: AuthUser) {
    const groupCount = await this.prisma.groupExercise.count();
    if (groupCount > 0) {
      await this.prisma.groupExercise.deleteMany({});
    }
    const count = await this.prisma.exercise.count();
    await this.prisma.exercise.deleteMany({});
    return { deleted: count };
  }

  /** Sync exercises from ExerciseDB API. */
  @Post("sync")
  @Roles(UserRole.ADMIN)
  syncFromExerciseDB(@CurrentUser() _user: AuthUser) {
    return this.syncService.syncFromExerciseDb();
  }

  /** Legacy route kept for compatibility while clients migrate. */
  @Post("sync-from-exercisedb")
  @Roles(UserRole.ADMIN)
  syncFromExerciseDBLegacy(@CurrentUser() _user: AuthUser) {
    return this.syncService.syncFromExerciseDb();
  }
}
