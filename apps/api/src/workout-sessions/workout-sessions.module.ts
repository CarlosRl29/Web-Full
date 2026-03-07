import { Module } from "@nestjs/common";
import { ExercisesModule } from "../exercises/exercises.module";
import { WorkoutExerciseSwapController } from "./workout-exercise-swap.controller";
import { WorkoutExerciseSwapService } from "./workout-exercise-swap.service";
import { WorkoutSessionsController } from "./workout-sessions.controller";
import { WorkoutSessionsService } from "./workout-sessions.service";

@Module({
  imports: [ExercisesModule],
  controllers: [WorkoutSessionsController, WorkoutExerciseSwapController],
  providers: [WorkoutSessionsService, WorkoutExerciseSwapService]
})
export class WorkoutSessionsModule {}
