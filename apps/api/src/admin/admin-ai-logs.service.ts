import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminAiLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns recent AI routine generation logs for admin observability.
   * Does not expose raw prompts - generation_input is PII-minimal (goal, level, equipment_count, etc.).
   */
  async getRoutineGenerationLogs(limit = 50) {
    const logs = await this.prisma.aiRoutineGenerationLog.findMany({
      orderBy: { created_at: "desc" },
      take: limit,
      select: {
        id: true,
        request_id: true,
        user_id: true,
        routine_id: true,
        success: true,
        failure_stage: true,
        duration_ms: true,
        model_name: true,
        prompt_chars: true,
        response_chars: true,
        repair_attempts: true,
        validation_errors: true,
        generation_input: true,
        seed_used: true,
        exercise_library_hash: true,
        knowledge_pack_version: true,
        quality_score: true,
        quality_reasons: true,
        created_at: true
      }
    });

    return {
      items: logs.map((log) => ({
        id: log.id,
        request_id: log.request_id,
        user_id: log.user_id,
        routine_id: log.routine_id,
        success: log.success,
        failure_stage: log.failure_stage,
        duration_ms: log.duration_ms,
        model_name: log.model_name,
        prompt_chars: log.prompt_chars,
        response_chars: log.response_chars,
        repair_attempts: log.repair_attempts,
        validation_errors: log.validation_errors,
        generation_input: log.generation_input,
        seed_used: log.seed_used,
        exercise_library_hash: log.exercise_library_hash,
        knowledge_pack_version: log.knowledge_pack_version,
        quality_score: log.quality_score,
        quality_reasons: log.quality_reasons,
        created_at: log.created_at
      })),
      count: logs.length
    };
  }
}
