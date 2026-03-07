import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { ExercisesModule } from "./exercises/exercises.module";
import { RoutinesModule } from "./routines/routines.module";
import { WorkoutSessionsModule } from "./workout-sessions/workout-sessions.module";
import { CoachModule } from "./coach/coach.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { HealthModule } from "./health/health.module";
// AXION v2 minimal core: disabled (do not delete)
// import { AiModule } from "./ai/ai.module";
// import { AdminModule } from "./admin/admin.module";
// import { ProgressModule } from "./progress/progress.module";
// import { PlansModule } from "./plans/plans.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { RolesGuard } from "./common/roles.guard";
import { ResponseInterceptor } from "./common/response.interceptor";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ExercisesModule,
    RoutinesModule,
    WorkoutSessionsModule,
    CoachModule,
    AnalyticsModule,
    HealthModule
    // AiModule, AdminModule, ProgressModule, PlansModule - disabled for v2 minimal core
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter }
  ]
})
export class AppModule {}
