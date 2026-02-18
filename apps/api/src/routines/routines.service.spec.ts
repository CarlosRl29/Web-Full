import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { RoutinesService } from "./routines.service";

describe("RoutinesService marketplace", () => {
  it("publishes own routine and sets metadata", async () => {
    const prisma = {
      routine: {
        findUnique: jest.fn().mockResolvedValue({ id: "r1", owner_id: "coach-1" }),
        update: jest.fn().mockResolvedValue({ id: "r1", days: [], reviews: [], _count: { reviews: 0 } })
      }
    } as any;
    const service = new RoutinesService(prisma);

    await service.publishRoutine("r1", "coach-1", UserRole.COACH, {
      is_public: true,
      marketplace_title: "Hipertrofia 4 dias",
      marketplace_goal: "Hipertrofia",
      marketplace_level: "Intermedio",
      marketplace_days_per_week: 4,
      marketplace_duration_weeks: 8,
      marketplace_description: "Plan base",
      marketplace_tags: ["masa", "gym"]
    });

    expect(prisma.routine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: expect.objectContaining({
          is_public: true,
          marketplace_title: "Hipertrofia 4 dias"
        })
      })
    );
  });

  it("blocks publish for non-owner coach", async () => {
    const prisma = {
      routine: {
        findUnique: jest.fn().mockResolvedValue({ id: "r1", owner_id: "coach-owner" })
      }
    } as any;
    const service = new RoutinesService(prisma);
    await expect(
      service.publishRoutine("r1", "coach-other", UserRole.COACH, {
        is_public: true,
        marketplace_title: "x",
        marketplace_goal: "x",
        marketplace_level: "x",
        marketplace_days_per_week: 3,
        marketplace_duration_weeks: 4,
        marketplace_description: "xxxx",
        marketplace_tags: []
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("clones public routine for user", async () => {
    const prisma = {
      routine: {
        findUnique: jest.fn().mockResolvedValue({
          id: "r-public",
          owner_id: "coach-1",
          is_public: true,
          name: "Plan coach",
          description: "desc",
          days: [
            {
              day_label: "Dia 1",
              order_index: 0,
              groups: [
                {
                  type: "SINGLE",
                  order_index: 0,
                  rounds_total: 1,
                  rest_between_exercises_seconds: 20,
                  rest_after_round_seconds: 90,
                  rest_after_set_seconds: 60,
                  exercises: [
                    {
                      exercise_id: "e1",
                      order_in_group: "A1",
                      target_sets_per_round: 3,
                      rep_range_min: 8,
                      rep_range_max: 12,
                      rep_range: "8-12",
                      notes: null
                    }
                  ]
                }
              ]
            }
          ]
        })
      }
    } as any;
    const service = new RoutinesService(prisma);
    const createSpy = jest.spyOn(service, "create").mockResolvedValue({ id: "new-routine" } as never);
    const cloned = await service.clonePublicRoutine("r-public", "user-1");
    expect(createSpy).toHaveBeenCalled();
    expect(cloned).toEqual({ id: "new-routine" });
  });

  it("saves rating review and refreshes aggregate", async () => {
    const prisma = {
      routine: {
        findUnique: jest.fn().mockResolvedValue({ id: "r1", owner_id: "coach-1", is_public: true }),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "r1", days: [], reviews: [], _count: { reviews: 1 } })
      },
      routineReview: {
        upsert: jest.fn().mockResolvedValue({}),
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 2 } })
      }
    } as any;
    const service = new RoutinesService(prisma);
    await service.upsertRoutineReview("r1", "user-1", { rating: 5, review: "Excelente" });
    expect(prisma.routineReview.upsert).toHaveBeenCalled();
    expect(prisma.routine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: { rating_average: 4.5, rating_count: 2 }
      })
    );
  });

  it("throws when marketplace routine not found", async () => {
    const prisma = { routine: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    const service = new RoutinesService(prisma);
    await expect(service.marketplaceDetail("missing", "u1", UserRole.USER)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
