import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ProgressController } from "./progress.controller";
import { ProgressService } from "./progress.service";
import { ProgressionService } from "./progression.service";

@Module({
  imports: [PrismaModule],
  controllers: [ProgressController],
  providers: [ProgressService, ProgressionService],
  exports: [ProgressService, ProgressionService]
})
export class ProgressModule {}
