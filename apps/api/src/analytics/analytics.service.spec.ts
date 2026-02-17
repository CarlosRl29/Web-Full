import { UserRole, WorkoutSessionStatus } from "@prisma/client";
import { AnalyticsService } from "./analytics.service";

describe("AnalyticsService", () => {
  it("computes volume_total from done sets", async () => {
    const prismaMock: any = {
      workoutSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: "session-1",
          user_id: "user-1",
          routine_day_id: "day-1",
          started_at: new Date("2026-02-17T10:00:00.000Z"),
          status: WorkoutSessionStatus.FINISHED,
          workout_groups: [
            {
              workout_items: [
                {
                  sets: [
                    { is_done: true, weight: 100, reps: 5, rpe: 8 },
                    { is_done: true, weight: 105, reps: 5, rpe: 8.5 },
                    { is_done: false, weight: 110, reps: 4, rpe: null }
                  ]
                }
              ]
            }
          ]
        }),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      routineAssignment: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    };

    const service = new AnalyticsService(prismaMock);
    const data = await service.getWorkoutSessionAnalytics("session-1", {
      sub: "user-1",
      role: UserRole.USER,
      email: "user@test.dev"
    });

    expect(data.volume_total).toBe(1025);
    expect(data.reps_total).toBe(10);
    expect(data.sets_done).toBe(2);
  });
});
