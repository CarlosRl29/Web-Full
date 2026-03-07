import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ProgressModule } from "../progress/progress.module";
import { AiRoutineModule } from "../modules/ai/ai-routine.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";

@Module({
  imports: [PrismaModule, AnalyticsModule, ProgressModule, AiRoutineModule],
  controllers: [AiController],
  providers: [AiService]
})
export class AiModule {}
