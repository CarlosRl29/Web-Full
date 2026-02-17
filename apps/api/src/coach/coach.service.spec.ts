import { UserRole } from "@prisma/client";
import { CoachService } from "./coach.service";

describe("CoachService", () => {
  const actor = { sub: "coach-1", role: UserRole.COACH, email: "coach@test.dev" };

  function createService() {
    const assignments: any[] = [];
    const prismaMock: any = {
      user: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id === "user-1") {
            return { id: "user-1", role: UserRole.USER };
          }
          return null;
        })
      },
      routine: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id === "routine-1") {
            return { id: "routine-1", owner_id: "coach-1" };
          }
          return null;
        })
      },
      routineAssignment: {
        findMany: jest.fn(async ({ where }: any) =>
          assignments.filter((item) => item.user_id === where.user_id)
        )
      },
      $transaction: jest.fn(async (callback: any) => {
        const tx = {
          routineAssignment: {
            updateMany: jest.fn(async ({ where, data }: any) => {
              assignments.forEach((item) => {
                if (item.user_id === where.user_id && item.is_active === where.is_active) {
                  item.is_active = data.is_active;
                }
              });
              return { count: 1 };
            }),
            upsert: jest.fn(async ({ where, update, create }: any) => {
              const found = assignments.find(
                (item) =>
                  item.coach_id === where.coach_id_user_id_routine_id.coach_id &&
                  item.user_id === where.coach_id_user_id_routine_id.user_id &&
                  item.routine_id === where.coach_id_user_id_routine_id.routine_id
              );
              if (found) {
                Object.assign(found, update);
                return found;
              }
              const created = {
                id: `assignment-${assignments.length + 1}`,
                ...create
              };
              assignments.push(created);
              return created;
            })
          }
        };
        return callback(tx);
      })
    };

    return {
      service: new CoachService(prismaMock),
      assignments
    };
  }

  it("creates assignment for coach", async () => {
    const { service } = createService();
    const assignment = await service.createAssignment(
      {
        user_id: "user-1",
        routine_id: "routine-1",
        is_active: true
      },
      actor
    );

    expect(assignment).toBeDefined();
    expect(assignment.user_id).toBe("user-1");
    expect(assignment.routine_id).toBe("routine-1");
  });

  it("lists assignments for user", async () => {
    const { service } = createService();
    await service.createAssignment(
      {
        user_id: "user-1",
        routine_id: "routine-1",
        is_active: true
      },
      actor
    );

    const list = await service.listMyAssignments("user-1");
    expect(list).toHaveLength(1);
  });

  it("does not create duplicate assignment rows", async () => {
    const { service, assignments } = createService();
    const payload = {
      user_id: "user-1",
      routine_id: "routine-1",
      is_active: true
    };
    await service.createAssignment(payload, actor);
    await service.createAssignment(payload, actor);

    expect(assignments).toHaveLength(1);
  });
});
