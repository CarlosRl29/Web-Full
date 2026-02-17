import { ExerciseGroupType } from "@prisma/client";
import { WorkoutSessionsService } from "../src/workout-sessions/workout-sessions.service";

describe("WorkoutSessionsService", () => {
  it("start creates snapshot groups and sets with overrides", async () => {
    const createdWorkoutGroups: Array<Record<string, unknown>> = [];

    const tx = {
      workoutSession: {
        updateMany: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: "session-1" }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "session-1",
          workout_groups: []
        })
      },
      workoutGroup: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          createdWorkoutGroups.push(data);
          return { id: `wg-${createdWorkoutGroups.length}` };
        })
      },
      workoutExerciseItem: {
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: `we-${data.order_in_group}` }))
      },
      workoutSet: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const prisma = {
      routine: {
        findUnique: jest.fn().mockResolvedValue({ id: "routine-1", owner_id: "user-1" })
      },
      routineAssignment: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      exerciseGroup: {
        findMany: jest.fn().mockResolvedValue([])
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      routineDay: {
        findUnique: jest.fn().mockResolvedValue({
          id: "day-1",
          routine_id: "routine-1",
          groups: [
            {
              id: "group-1",
              type: ExerciseGroupType.SUPERSET_2,
              order_index: 0,
              rounds_total: 3,
              rest_between_exercises_seconds: 20,
              rest_after_round_seconds: 90,
              rest_after_set_seconds: null,
              exercises: [
                {
                  id: "ge-1",
                  order_in_group: "A1",
                  target_sets_per_round: 1,
                  rep_range: "8-10",
                  notes: null
                },
                {
                  id: "ge-2",
                  order_in_group: "A2",
                  target_sets_per_round: 1,
                  rep_range: "10-12",
                  notes: null
                }
              ]
            }
          ]
        })
      },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(tx))
    } as any;

    const service = new WorkoutSessionsService(prisma);
    await service.start(
      {
        routine_id: "routine-1",
        day_id: "day-1",
        overrides: {
          rest_between_exercises_seconds: 15,
          rest_after_round_seconds: 75
        }
      },
      "user-1"
    );

    expect(createdWorkoutGroups[0].rest_between_exercises_seconds).toBe(15);
    expect(createdWorkoutGroups[0].rest_after_round_seconds).toBe(75);
    expect(tx.workoutSet.create).toHaveBeenCalledTimes(6);
  });
});
