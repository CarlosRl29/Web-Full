import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AiService } from "./ai.service";

describe("AiService", () => {
  const actorUser = { sub: "user-1", role: UserRole.USER, email: "user@test.dev" };
  const actorCoach = { sub: "coach-1", role: UserRole.COACH, email: "coach@test.dev" };
  const actorAdmin = { sub: "admin-1", role: UserRole.ADMIN, email: "admin@test.dev" };

  function buildService(overrides?: {
    logs?: any[];
    assignments?: Array<{ coach_id: string; user_id: string; is_active: boolean }>;
  }) {
    const logs = overrides?.logs ?? [];
    const assignments = overrides?.assignments ?? [];
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
        findMany: jest.fn().mockImplementation(async ({ where, orderBy, take }: any) => {
          let filtered = [...logs];
          if (where?.user_id?.in) {
            filtered = filtered.filter((item) => where.user_id.in.includes(item.user_id));
          }
          if (where?.OR) {
            const [a, b] = where.OR;
            filtered = filtered.filter((item) => {
              const created = new Date(item.created_at).getTime();
              const aTs = new Date(a.created_at.lt).getTime();
              if (created < aTs) {
                return true;
              }
              if (
                b?.created_at &&
                new Date(item.created_at).getTime() ===
                  new Date(b.created_at).getTime() &&
                item.id < b.id.lt
              ) {
                return true;
              }
              return false;
            });
          }
          filtered.sort((l, r) => {
            const diff = new Date(r.created_at).getTime() - new Date(l.created_at).getTime();
            if (diff !== 0) {
              return diff;
            }
            return r.id.localeCompare(l.id);
          });
          return filtered.slice(0, take ?? filtered.length);
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
          logs.find((item) => item.id === where.id) ?? null
        )
      },
      routineAssignment: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) =>
          assignments.find(
            (item) =>
              item.coach_id === where.coach_id &&
              item.user_id === where.user_id &&
              item.is_active === where.is_active
          ) ?? null
        ),
        findMany: jest.fn().mockImplementation(async ({ where }: any) =>
          assignments
            .filter(
              (item) => item.coach_id === where.coach_id && item.is_active === where.is_active
            )
            .map((item) => ({ user_id: item.user_id }))
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
    expect(response.strategy_version).toBe("3.2.0");
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
          strategy_version: "3.2.0"
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
          strategy_version: "3.2.0"
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
          strategy_version: "3.2.0"
        },
        {
          id: "log-2",
          user_id: "user-1",
          coach_id: null,
          created_at: new Date("2026-02-17T12:02:00.000Z"),
          safety_flags: [],
          model_version: "m",
          strategy_version: "3.2.0"
        },
        {
          id: "log-1",
          user_id: "user-1",
          coach_id: null,
          created_at: new Date("2026-02-17T12:01:00.000Z"),
          safety_flags: [],
          model_version: "m",
          strategy_version: "3.2.0"
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
});
