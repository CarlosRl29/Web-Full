import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";

@Module({
  imports: [PrismaModule, AnalyticsModule],
  controllers: [AiController],
  providers: [AiService]
})
export class AiModule {}
