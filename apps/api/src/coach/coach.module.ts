import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CoachController } from "./coach.controller";
import { CoachService } from "./coach.service";
import { MeAssignmentsController } from "./me-assignments.controller";

@Module({
  imports: [PrismaModule],
  controllers: [CoachController, MeAssignmentsController],
  providers: [CoachService]
})
export class CoachModule {}
