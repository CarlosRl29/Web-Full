import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { ExercisesModule } from "./exercises/exercises.module";
import { RoutinesModule } from "./routines/routines.module";
import { WorkoutSessionsModule } from "./workout-sessions/workout-sessions.module";
import { CoachModule } from "./coach/coach.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { RolesGuard } from "./common/roles.guard";
import { ResponseInterceptor } from "./common/response.interceptor";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ExercisesModule,
    RoutinesModule,
    WorkoutSessionsModule,
    CoachModule,
    AnalyticsModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor }
  ]
})
export class AppModule {}
