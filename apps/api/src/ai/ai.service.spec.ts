import { UserRole } from "@prisma/client";
import { AiService } from "./ai.service";

describe("AiService", () => {
  it("saves audit log and enables guardrails on acute pain", async () => {
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
        create: jest.fn().mockResolvedValue({})
      }
    } as any;

    const service = new AiService(analyticsService as any, prisma);
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
      {
        sub: "user-1",
        role: UserRole.USER,
        email: "user@test.dev"
      }
    );

    expect(response.safe_mode).toBe(true);
    expect(response.safety_flags).toContain("acute_pain_guardrail");
    expect(prisma.aiRecommendationLog.create).toHaveBeenCalledTimes(1);
  });
});
