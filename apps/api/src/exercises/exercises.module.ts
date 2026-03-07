import { Module } from "@nestjs/common";
import { ExercisesController } from "./exercises.controller";
import { ExerciseReplacementService } from "./exercise-replacement.service";
import { ExerciseSyncService } from "./exercise-sync.service";
import { ExercisesService } from "./exercises.service";

@Module({
  controllers: [ExercisesController],
  providers: [ExercisesService, ExerciseReplacementService, ExerciseSyncService],
  exports: [ExercisesService, ExerciseReplacementService, ExerciseSyncService]
})
export class ExercisesModule {}
