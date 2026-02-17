import {
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AiService } from "./ai.service";

describe("AiService", () => {
  const actorUser = { sub: "user-1", role: UserRole.USER, email: "user@test.dev" };
  const actorUserTwo = { sub: "user-2", role: UserRole.USER, email: "user2@test.dev" };
  const actorCoach = { sub: "coach-1", role: UserRole.COACH, email: "coach@test.dev" };
  const actorAdmin = { sub: "admin-1", role: UserRole.ADMIN, email: "admin@test.dev" };

  function buildService(overrides?: {
    logs?: any[];
    assignments?: Array<{ coach_id: string; user_id: string; is_active: boolean }>;
    routines?: Array<{ id: string; owner_id: string }>;
    days?: Array<{ id: string; routine_id: string }>;
    applied?: any[];
  }) {
    const logs = overrides?.logs ?? [];
    const assignments = overrides?.assignments ?? [];
    const routines = overrides?.routines ?? [{ id: "routine-1", owner_id: "coach-1" }];
    const days = overrides?.days ?? [{ id: "day-1", routine_id: "routine-1" }];
    const applied = overrides?.applied ?? [];
    const analyticsService = {
      getTrainingSummary: jest.fn().mockResolvedValue({
        window_days: 28,
        sessions_count: 4,
        volume_total: 12000,
        reps_total: 220,
        sets_done: 40,
        adherence: 0.9,
        average_rpe: 7.5,
        sessions: []
      })
    };
    const prisma = {
      aiRecommendationLog: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const created = {
            id: `log-${logs.length + 1}`,
            created_at: new Date(),
            ...data
          };
          logs.push(created);
          return created;
        }),
        findMany: jest.fn().mockImplementation(async ({ where, take }: any) => {
          let filtered = [...logs];
          if (where?.user_id?.in) {
            filtered = filtered.filter((item) => where.user_id.in.includes(item.user_id));
          }
          if (where?.user_id && typeof where.user_id === "string") {
            filtered = filtered.filter((item) => item.user_id === where.user_id);
          }
          if (where?.coach_id && typeof where.coach_id === "string") {
            filtered = filtered.filter((item) => item.coach_id === where.coach_id);
          }
          if (where?.safety_flags?.has) {
            filtered = filtered.filter((item) =>
              (item.safety_flags ?? []).includes(where.safety_flags.has)
            );
          }
          if (where?.created_at?.gte) {
            const fromTs = new Date(where.created_at.gte).getTime();
            filtered = filtered.filter((item) => new Date(item.created_at).getTime() >= fromTs);
          }
          if (where?.created_at?.lte) {
            const toTs = new Date(where.created_at.lte).getTime();
            filtered = filtered.filter((item) => new Date(item.created_at).getTime() <= toTs);
          }
          if (where?.OR) {
            filtered = filtered.filter((item) =>
              where.OR.some((condition: any) => {
                if (condition.created_at?.lt) {
                  const created = new Date(item.created_at).getTime();
                  const aTs = new Date(condition.created_at.lt).getTime();
                  return created < aTs;
                }
                if (condition.created_at && condition.id?.lt) {
                  return (
                    new Date(item.created_at).getTime() ===
                      new Date(condition.created_at).getTime() && item.id < condition.id.lt
                  );
                }
                if (condition.user_id?.in) {
                  return condition.user_id.in.includes(item.user_id);
                }
                if (condition.applied_suggestions?.some?.routine_id?.in) {
                  const ids: string[] = condition.applied_suggestions.some.routine_id.in;
                  return (item.applied_suggestions ?? []).some((a: any) =>
                    ids.includes(a.routine_id)
                  );
                }
                return false;
              })
            );
          }
          filtered.sort((l, r) => {
            const diff = new Date(r.created_at).getTime() - new Date(l.created_at).getTime();
            if (diff !== 0) {
              return diff;
            }
            return r.id.localeCompare(l.id);
          });
          const mapped = filtered.map((item) => ({
            ...item,
            applied_suggestions: item.applied_suggestions ?? []
          }));
          return mapped.slice(0, take ?? mapped.length);
        }),
        count: jest.fn().mockImplementation(async ({ where }: any) => {
          let filtered = [...logs];
          if (where?.user_id) {
            filtered = filtered.filter((item) => item.user_id === where.user_id);
          }
          if (where?.coach_id) {
            filtered = filtered.filter((item) => item.coach_id === where.coach_id);
          }
          if (typeof where?.dedup_hit === "boolean") {
            filtered = filtered.filter((item) => Boolean(item.dedup_hit) === where.dedup_hit);
          }
          if (typeof where?.rate_limited === "boolean") {
            filtered = filtered.filter(
              (item) => Boolean(item.rate_limited) === where.rate_limited
            );
          }
          if (where?.created_at?.gte) {
            const fromTs = new Date(where.created_at.gte).getTime();
            filtered = filtered.filter((item) => new Date(item.created_at).getTime() >= fromTs);
          }
          return filtered.length;
        }),
        findFirst: jest.fn().mockImplementation(async ({ where, orderBy }: any) => {
          let filtered = [...logs];
          if (where?.user_id) {
            filtered = filtered.filter((item) => item.user_id === where.user_id);
          }
          if (where?.request_hash) {
            filtered = filtered.filter((item) => item.request_hash === where.request_hash);
          }
          if (typeof where?.rate_limited === "boolean") {
            filtered = filtered.filter(
              (item) => Boolean(item.rate_limited) === where.rate_limited
            );
          }
          if (where?.created_at?.gte) {
            const gte = new Date(where.created_at.gte).getTime();
            filtered = filtered.filter((item) => new Date(item.created_at).getTime() >= gte);
          }
          if (orderBy?.created_at === "desc") {
            filtered.sort(
              (l, r) => new Date(r.created_at).getTime() - new Date(l.created_at).getTime()
            );
          }
          return filtered[0] ?? null;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where, include }: any) => {
          const row = logs.find((item) => item.id === where.id) ?? null;
          if (!row) {
            return null;
          }
          if (include?.applied_suggestions) {
            return {
              ...row,
              applied_suggestions: applied
                .filter((item) => item.ai_log_id === row.id)
                .map((item) => ({
                  id: item.id,
                  routine_id: item.routine_id,
                  routine_day_id: item.routine_day_id,
                  applied_by_user_id: item.applied_by_user_id,
                  created_at: item.created_at
                }))
            };
          }
          return row;
        })
      },
      aiAppliedSuggestion: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const created = {
            id: `applied-${applied.length + 1}`,
            created_at: new Date(),
            ...data
          };
          applied.push(created);
          return created;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }: any) => {
          let filtered = [...applied];
          if (where?.routine_id) {
            filtered = filtered.filter((item) => item.routine_id === where.routine_id);
          }
          if (where?.routine_day_id) {
            filtered = filtered.filter((item) => item.routine_day_id === where.routine_day_id);
          }
          return filtered.map((item) => ({
            ...item,
            ai_log: logs.find((l) => l.id === item.ai_log_id)
              ? {
                  id: item.ai_log_id,
                  created_at: logs.find((l) => l.id === item.ai_log_id).created_at,
                  model_version: logs.find((l) => l.id === item.ai_log_id).model_version,
                  strategy_version: logs.find((l) => l.id === item.ai_log_id).strategy_version
                }
              : null
          }));
        })
      },
      routineAssignment: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) =>
          assignments.find(
            (item) =>
              item.coach_id === where.coach_id &&
              item.is_active === where.is_active &&
              (where.user_id ? item.user_id === where.user_id : true) &&
              (where.routine_id ? (item as any).routine_id === where.routine_id : true)
          ) ?? null
        ),
        findMany: jest.fn().mockImplementation(async ({ where }: any) =>
          assignments
            .filter(
              (item) =>
                item.coach_id === where.coach_id &&
                item.is_active === where.is_active &&
                ((item as any).routine_id
                  ? (where.routine_id ? (item as any).routine_id === where.routine_id : true)
                  : true)
            )
            .map((item) => ({ user_id: item.user_id, routine_id: (item as any).routine_id }))
        )
      },
      routine: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
          routines.find((item) => item.id === where.id) ?? null
        ),
        findMany: jest.fn().mockImplementation(async ({ where }: any) =>
          routines.filter((item) => item.owner_id === where.owner_id).map((item) => ({ id: item.id }))
        )
      },
      routineDay: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
          days.find((item) => item.id === where.id) ?? null
        )
      }
    } as any;

    return { service: new AiService(analyticsService as any, prisma), analyticsService, prisma };
  }

  it("does not process when AI_ENABLED is false", async () => {
    process.env.AI_ENABLED = "false";
    const { service, analyticsService, prisma } = buildService();

    await expect(
      service.getRecommendations(
        {
          profile: {
            experience_level: "INTERMEDIATE",
            goal: "HYPERTROPHY",
            days_per_week: 4
          },
          context: { window_days: 28 }
        },
        actorUser
      )
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(analyticsService.getTrainingSummary).not.toHaveBeenCalled();
    expect(prisma.aiRecommendationLog.create).not.toHaveBeenCalled();
    delete process.env.AI_ENABLED;
  });

  it("saves audit log and enables guardrails on acute pain", async () => {
    process.env.AI_ENABLED = "true";
    const { service, prisma } = buildService();
    const response = await service.getRecommendations(
      {
        profile: {
          experience_level: "INTERMEDIATE",
          goal: "HYPERTROPHY",
          days_per_week: 4
        },
        constraints: {
          injuries: "dolor agudo en hombro",
          acute_pain: true
        },
        context: { window_days: 28 }
      },
      actorUser
    );

    expect(response.safe_mode).toBe(true);
    expect(response.safety_flags).toContain("acute_pain_guardrail");
    expect(prisma.aiRecommendationLog.create).toHaveBeenCalledTimes(1);
    expect(response.model_version).toBeTruthy();
    expect(response.strategy_version).toBe("3.3.0");
    expect(response.dedup_hit).toBe(false);
    expect(response.ai_log_id).toBeTruthy();
    expect(response.plan_suggestions.length).toBeGreaterThan(0);
    delete process.env.AI_ENABLED;
  });

  it("admin can list logs", async () => {
    const { service } = buildService({
      logs: [
        {
          id: "log-1",
          user_id: "user-1",
          coach_id: null,
          created_at: new Date("2026-02-17T12:00:00.000Z"),
          safety_flags: [],
          model_version: "m",
          strategy_version: "3.3.0"
        }
      ]
    });

    const data = await service.getLogs(actorAdmin, { limit: 10 });
    expect(data.items).toHaveLength(1);
  });

  it("coach cannot read logs without active assignment", async () => {
    const { service } = buildService({
      logs: [
        {
          id: "log-1",
          user_id: "user-2",
          coach_id: null,
          created_at: new Date("2026-02-17T12:00:00.000Z"),
          request_payload: {},
          response_payload: {},
          safety_flags: [],
          model_version: "m",
          strategy_version: "3.3.0"
        }
      ],
      assignments: [{ coach_id: "coach-1", user_id: "user-1", is_active: true }]
    });

    await expect(service.getLogById(actorCoach, "log-1")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("cursor pagination returns stable pages", async () => {
    const { service } = buildService({
      logs: [
        {
          id: "log-3",
          user_id: "user-1",
          coach_id: null,
          created_at: new Date("2026-02-17T12:03:00.000Z"),
          safety_flags: [],
          model_version: "m",
          strategy_version: "3.3.0"
        },
        {
          id: "log-2",
          user_id: "user-1",
          coach_id: null,
          created_at: new Date("2026-02-17T12:02:00.000Z"),
          safety_flags: [],
          model_version: "m",
          strategy_version: "3.3.0"
        },
        {
          id: "log-1",
          user_id: "user-1",
          coach_id: null,
          created_at: new Date("2026-02-17T12:01:00.000Z"),
          safety_flags: [],
          model_version: "m",
          strategy_version: "3.3.0"
        }
      ]
    });

    const firstPage = await service.getLogs(actorAdmin, { limit: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.next_cursor).toBeTruthy();

    const secondPage = await service.getLogs(actorAdmin, {
      limit: 2,
      cursor: firstPage.next_cursor ?? undefined
    });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].id).toBe("log-1");
  });

  it("rate limit blocks when quota exceeded", async () => {
    process.env.AI_ENABLED = "true";
    process.env.AI_RATE_LIMIT_PER_DAY = "1";
    const now = new Date();
    const { service, prisma } = buildService({
      logs: [
        {
          id: "log-old",
          user_id: "user-1",
          created_at: now,
          request_hash: "other-hash",
          response_payload: { safe_mode: false },
          safety_flags: [],
          model_version: "m",
          strategy_version: "3.3.0"
        }
      ]
    });

    await expect(
      service.getRecommendations(
        {
          profile: {
            experience_level: "INTERMEDIATE",
            goal: "HYPERTROPHY",
            days_per_week: 4
          },
          context: { window_days: 28 }
        },
        actorUser
      )
    ).rejects.toMatchObject({ status: 429 });

    await expect(
      service.getRecommendations(
        {
          profile: {
            experience_level: "INTERMEDIATE",
            goal: "HYPERTROPHY",
            days_per_week: 4
          },
          context: { window_days: 28 }
        },
        actorUser
      )
    ).rejects.toBeInstanceOf(HttpException);

    expect(prisma.aiRecommendationLog.create).toHaveBeenCalledTimes(2);
    delete process.env.AI_ENABLED;
    delete process.env.AI_RATE_LIMIT_PER_DAY;
  });

  it("dedup returns cached response for same input", async () => {
    process.env.AI_ENABLED = "true";
    process.env.AI_RATE_LIMIT_PER_DAY = "10";
    process.env.AI_DEDUP_WINDOW_HOURS = "6";
    const cachedResponse = {
      ai_log_id: "log-cached",
      model_version: "cache-model",
      strategy_version: "3.3.0",
      dedup_hit: false,
      safe_mode: false,
      safety_flags: [],
      rationale: ["cached"],
      plan_suggestions: [],
      disclaimer: "d",
      recommendation_summary: "cached result",
      adjustments: [],
      based_on: {
        window_days: 28,
        sessions_analyzed: 1,
        volume_total: 100,
        adherence: 1,
        average_rpe: 7
      }
    };
    const { service, prisma } = buildService({
      logs: [
        {
          id: "log-cached",
          user_id: "user-1",
          created_at: new Date(),
          request_hash:
            "b9edb0c5e04c1ae4ff8f113142db506bf61d23adc47f9ed8ec5f5ca159b5f362",
          response_payload: cachedResponse,
          safety_flags: [],
          model_version: "cache-model",
          strategy_version: "3.3.0"
        }
      ]
    });

    const originalHashFn = (service as any).buildRequestHash;
    (service as any).buildRequestHash = jest
      .fn()
      .mockReturnValue("b9edb0c5e04c1ae4ff8f113142db506bf61d23adc47f9ed8ec5f5ca159b5f362");

    const response = await service.getRecommendations(
      {
        profile: {
          experience_level: "INTERMEDIATE",
          goal: "HYPERTROPHY",
          days_per_week: 4
        },
        context: { window_days: 28 }
      },
      actorUser
    );

    expect(response.recommendation_summary).toBe("cached result");
    expect(response.dedup_hit).toBe(true);
    expect(prisma.aiRecommendationLog.create).toHaveBeenCalledTimes(1);

    (service as any).buildRequestHash = originalHashFn;
    delete process.env.AI_ENABLED;
    delete process.env.AI_RATE_LIMIT_PER_DAY;
    delete process.env.AI_DEDUP_WINDOW_HOURS;
  });

  it("marks dedup_hit false then true for repeated same-user request", async () => {
    process.env.AI_ENABLED = "true";
    process.env.AI_RATE_LIMIT_PER_DAY = "10";
    process.env.AI_DEDUP_WINDOW_HOURS = "6";
    const { service, prisma } = buildService();

    const payload = {
      profile: {
        experience_level: "INTERMEDIATE" as const,
        goal: "HYPERTROPHY" as const,
        days_per_week: 4
      },
      context: { window_days: 28 }
    };

    const first = await service.getRecommendations(payload, actorUser);
    const second = await service.getRecommendations(payload, actorUser);

    expect(first.dedup_hit).toBe(false);
    expect(second.dedup_hit).toBe(true);
    expect(prisma.aiRecommendationLog.create).toHaveBeenCalledTimes(2);

    delete process.env.AI_ENABLED;
    delete process.env.AI_RATE_LIMIT_PER_DAY;
    delete process.env.AI_DEDUP_WINDOW_HOURS;
  });

  it("does not share dedup cache across different users", async () => {
    process.env.AI_ENABLED = "true";
    process.env.AI_RATE_LIMIT_PER_DAY = "10";
    process.env.AI_DEDUP_WINDOW_HOURS = "6";
    const { service, prisma } = buildService();

    const payload = {
      profile: {
        experience_level: "INTERMEDIATE" as const,
        goal: "HYPERTROPHY" as const,
        days_per_week: 4
      },
      context: { window_days: 28 }
    };

    const firstUser = await service.getRecommendations(payload, actorUser);
    const secondUser = await service.getRecommendations(payload, actorUserTwo);

    expect(firstUser.dedup_hit).toBe(false);
    expect(secondUser.dedup_hit).toBe(false);
    expect(prisma.aiRecommendationLog.create).toHaveBeenCalledTimes(2);

    delete process.env.AI_ENABLED;
    delete process.env.AI_RATE_LIMIT_PER_DAY;
    delete process.env.AI_DEDUP_WINDOW_HOURS;
  });

  it("creates AiAppliedSuggestion for coach/admin", async () => {
    const { service, prisma } = buildService({
      logs: [
        {
          id: "log-1",
          user_id: "user-1",
          coach_id: "coach-1",
          created_at: new Date(),
          safety_flags: [],
          model_version: "m",
          strategy_version: "3.3.0"
        }
      ],
      assignments: [
        { coach_id: "coach-1", user_id: "user-1", is_active: true, routine_id: "routine-1" } as any
      ]
    });

    const created = await service.createAppliedSuggestion(actorCoach, {
      ai_log_id: "log-1",
      routine_id: "routine-1",
      routine_day_id: "day-1",
      applied_changes: { set_delta: 1 }
    });

    expect(created.id).toBeTruthy();
    expect(prisma.aiAppliedSuggestion.create).toHaveBeenCalledTimes(1);
  });

  it("blocks non coach/admin from creating applied suggestions", async () => {
    const { service } = buildService({
      logs: [
        {
          id: "log-1",
          user_id: "user-1",
          coach_id: "coach-1",
          created_at: new Date(),
          safety_flags: [],
          model_version: "m",
          strategy_version: "3.3.0"
        }
      ]
    });

    await expect(
      service.createAppliedSuggestion(actorUser, {
        ai_log_id: "log-1",
        routine_id: "routine-1",
        routine_day_id: "day-1",
        applied_changes: { set_delta: 1 }
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("metrics calculate dedup_savings_pct correctly", async () => {
    const { service } = buildService({
      logs: [
        {
          id: "l1",
          user_id: "user-1",
          coach_id: "coach-1",
          created_at: new Date(),
          dedup_hit: true,
          rate_limited: false
        },
        {
          id: "l2",
          user_id: "user-1",
          coach_id: "coach-1",
          created_at: new Date(),
          dedup_hit: false,
          rate_limited: true
        },
        {
          id: "l3",
          user_id: "user-1",
          coach_id: "coach-1",
          created_at: new Date(),
          dedup_hit: true,
          rate_limited: false
        },
        {
          id: "l4",
          user_id: "user-1",
          coach_id: "coach-1",
          created_at: new Date(),
          dedup_hit: false,
          rate_limited: false
        }
      ]
    });

    const metrics = await service.getMetrics(actorCoach, 7);
    expect(metrics.total).toBe(4);
    expect(metrics.dedup_hits).toBe(2);
    expect(metrics.rate_limited).toBe(1);
    expect(metrics.dedup_savings_pct).toBe(50);
  });

  it("coach cannot export logs outside scope", async () => {
    const { service } = buildService({
      logs: [
        {
          id: "l1",
          user_id: "user-2",
          coach_id: "coach-2",
          created_at: new Date(),
          strategy_version: "3.3.0",
          model_version: "m",
          dedup_hit: false,
          rate_limited: false,
          latency_ms: 12,
          safety_flags: ["acute_pain_guardrail"],
          request_payload: {},
          response_payload: {},
          applied_suggestions: []
        }
      ],
      assignments: [{ coach_id: "coach-1", user_id: "user-1", is_active: true } as any],
      routines: [{ id: "routine-1", owner_id: "coach-1" }]
    });

    const csv = await service.exportLogsCsv(actorCoach, {});
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(1);
  });

  it("csv export returns header and rows", async () => {
    const { service } = buildService({
      logs: [
        {
          id: "l1",
          user_id: "user-1",
          coach_id: "coach-1",
          created_at: new Date("2026-02-17T10:00:00.000Z"),
          strategy_version: "3.3.0",
          model_version: "m",
          dedup_hit: true,
          rate_limited: false,
          latency_ms: 20,
          safety_flags: ["acute_pain_guardrail"],
          request_payload: { context: { window_days: 28 } },
          response_payload: { recommendation_summary: "ok", safety_flags: ["acute_pain_guardrail"] },
          applied_suggestions: [
            {
              routine_id: "routine-1",
              routine_day_id: "day-1",
              applied_by_user_id: "coach-1"
            }
          ]
        }
      ]
    });

    const csv = await service.exportLogsCsv(actorAdmin, {
      from: "2026-02-16T00:00:00.000Z",
      to: "2026-02-18T00:00:00.000Z"
    });
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain("created_at,user_id,coach_id");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[1]).toContain("routine-1");
  });
});
