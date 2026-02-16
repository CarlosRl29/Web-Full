import { Module } from "@nestjs/common";
import { WorkoutSessionsController } from "./workout-sessions.controller";
import { WorkoutSessionsService } from "./workout-sessions.service";

@Module({
  controllers: [WorkoutSessionsController],
  providers: [WorkoutSessionsService]
})
export class WorkoutSessionsModule {}
