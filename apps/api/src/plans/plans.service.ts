import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type StartPlanInput = {
  goal: string;
  priorityArea: string;
  weeksTotal: number;
  milestones?: unknown;
};

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async startPlan(userId: string, input: StartPlanInput) {
    return this.prisma.trainingPlan.create({
      data: {
        user_id: userId,
        goal: input.goal,
        priority_area: input.priorityArea,
        start_date: new Date(),
        weeks_total: input.weeksTotal,
        milestones: input.milestones ?? undefined
      }
    });
  }

  async getCurrentPlan(userId: string) {
    const plan = await this.prisma.trainingPlan.findFirst({
      where: { user_id: userId },
      orderBy: { start_date: "desc" }
    });
    return plan;
  }
}
