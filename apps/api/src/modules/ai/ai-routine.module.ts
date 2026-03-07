import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AnalyticsModule } from "../../analytics/analytics.module";
import { RoutinesModule } from "../../routines/routines.module";
import { ProgressModule } from "../../progress/progress.module";
import { ExerciseLibraryService } from "./exercise-library.service";
import { AiToolsService } from "./ai-tools.service";
import { RoutineValidationService } from "./routine-validation.service";
import { RoutineQualityService } from "./routine-quality.service";
import { RoutineGeneratorService } from "./routine-generator.service";
import { KnowledgeRetrieverService } from "./knowledge/knowledge-retriever.service";
import { AxionRoutineGeneratorService } from "./axion/axion-routine-generator.service";
import { AxionSingleDayGeneratorService } from "./axion/axion-single-day-generator.service";

@Module({
  imports: [PrismaModule, AnalyticsModule, RoutinesModule, ProgressModule],
  providers: [
    ExerciseLibraryService,
    AiToolsService,
    RoutineValidationService,
    RoutineQualityService,
    KnowledgeRetrieverService,
    RoutineGeneratorService,
    AxionRoutineGeneratorService,
    AxionSingleDayGeneratorService
  ],
  exports: [
    RoutineGeneratorService,
    AxionRoutineGeneratorService,
    AxionSingleDayGeneratorService,
    ExerciseLibraryService,
    AiToolsService
  ]
})
export class AiRoutineModule {}
