import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ExercisesModule } from "../exercises/exercises.module";
import { AdminAiLogsController } from "./admin-ai-logs.controller";
import { AdminAiLogsService } from "./admin-ai-logs.service";
import { AdminExercisesSyncController } from "./admin-exercises-sync.controller";
import { AdminExercisesTranslationsController } from "./admin-exercises-translations.controller";
import { AdminExercisesTranslationsService } from "./admin-exercises-translations.service";

@Module({
  imports: [PrismaModule, ExercisesModule],
  controllers: [
    AdminAiLogsController,
    AdminExercisesSyncController,
    AdminExercisesTranslationsController
  ],
  providers: [
    AdminAiLogsService,
    AdminExercisesTranslationsService
  ]
})
export class AdminModule {}
