-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'COACH', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserMode" AS ENUM ('USER', 'COACH');

-- CreateEnum
CREATE TYPE "TrainingGoal" AS ENUM ('STRENGTH', 'HYPERTROPHY', 'MIXED');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ExerciseGroupType" AS ENUM ('SINGLE', 'SUPERSET_2', 'SUPERSET_3');

-- CreateEnum
CREATE TYPE "WorkoutSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'CORE');

-- CreateEnum
CREATE TYPE "Submuscle" AS ENUM ('UPPER_CHEST', 'MID_CHEST', 'LOWER_CHEST', 'LATS', 'UPPER_BACK', 'MID_BACK', 'LOWER_BACK', 'TRAPS', 'ANTERIOR_DELTOID', 'LATERAL_DELTOID', 'REAR_DELTOID', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ABS', 'OBLIQUES', 'ERECTORS', 'BICEPS', 'TRICEPS');

-- CreateEnum
CREATE TYPE "MovementPattern" AS ENUM ('PUSH', 'PULL', 'SQUAT', 'HINGE', 'LUNGE', 'CARRY', 'CORE', 'ISOLATION');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('COMPOUND', 'ISOLATION');

-- CreateEnum
CREATE TYPE "ExerciseDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('es', 'en');

-- CreateEnum
CREATE TYPE "SwapReason" AS ENUM ('EQUIPMENT_BUSY', 'NOT_AVAILABLE', 'PAIN', 'PREFERENCE', 'TOO_HARD');

-- CreateEnum
CREATE TYPE "PreferenceType" AS ENUM ('AVOID', 'PREFER');

-- CreateEnum
CREATE TYPE "PreferenceReason" AS ENUM ('EQUIPMENT', 'PAIN', 'PREFERENCE', 'TOO_HARD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "preferred_modes" "UserMode"[] DEFAULT ARRAY['USER']::"UserMode"[],
    "active_mode" "UserMode" NOT NULL DEFAULT 'USER',
    "goal" "TrainingGoal",
    "experience_level" "ExperienceLevel",
    "days_per_week" INTEGER,
    "session_minutes" INTEGER,
    "weight_kg" DOUBLE PRECISION,
    "height_cm" INTEGER,
    "body_fat_pct" DOUBLE PRECISION,
    "age" INTEGER,
    "injuries" TEXT,
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active_routine_id" TEXT,
    "refresh_token_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canonical_slug" TEXT,
    "source" TEXT DEFAULT 'manual',
    "muscle_group" TEXT NOT NULL,
    "sub_muscle" TEXT,
    "body_part" TEXT,
    "equipment" TEXT,
    "instructions" TEXT,
    "media_url" TEXT,
    "primary_muscle" "MuscleGroup",
    "primary_submuscle" "Submuscle",
    "secondary_muscles" "MuscleGroup"[] DEFAULT ARRAY[]::"MuscleGroup"[],
    "movement_pattern" "MovementPattern",
    "movement_pattern_secondary" "MovementPattern"[] DEFAULT ARRAY[]::"MovementPattern"[],
    "exercise_type" "ExerciseType",
    "difficulty" "ExerciseDifficulty",
    "exercise_family" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseMuscleRank" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "muscle" "MuscleGroup" NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "ExerciseMuscleRank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseTranslation" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "short_description" TEXT,
    "technique_steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "common_mistakes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "marketplace_title" TEXT,
    "marketplace_goal" TEXT,
    "marketplace_level" TEXT,
    "marketplace_days_per_week" INTEGER,
    "marketplace_duration_weeks" INTEGER,
    "marketplace_description" TEXT,
    "marketplace_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rating_average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineReview" (
    "id" TEXT NOT NULL,
    "routine_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachFollow" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineDay" (
    "id" TEXT NOT NULL,
    "routine_id" TEXT NOT NULL,
    "day_label" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "RoutineDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseGroup" (
    "id" TEXT NOT NULL,
    "routine_day_id" TEXT NOT NULL,
    "type" "ExerciseGroupType" NOT NULL,
    "order_index" INTEGER NOT NULL,
    "rounds_total" INTEGER NOT NULL,
    "rest_between_exercises_seconds" INTEGER NOT NULL DEFAULT 0,
    "rest_after_round_seconds" INTEGER NOT NULL DEFAULT 0,
    "rest_after_set_seconds" INTEGER,

    CONSTRAINT "ExerciseGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupExercise" (
    "id" TEXT NOT NULL,
    "exercise_group_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "order_in_group" TEXT NOT NULL,
    "target_sets_per_round" INTEGER NOT NULL,
    "rep_range_min" INTEGER,
    "rep_range_max" INTEGER,
    "rep_range" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "GroupExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineAssignment" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "routine_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coach_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "routine_id" TEXT NOT NULL,
    "routine_day_id" TEXT NOT NULL,
    "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "current_pointer" JSONB,
    "override_rest_between_exercises_seconds" INTEGER,
    "override_rest_after_round_seconds" INTEGER,
    "override_rest_after_set_seconds" INTEGER,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutGroup" (
    "id" TEXT NOT NULL,
    "workout_session_id" TEXT NOT NULL,
    "source_group_id" TEXT NOT NULL,
    "type" "ExerciseGroupType" NOT NULL,
    "order_index" INTEGER NOT NULL,
    "rounds_total" INTEGER NOT NULL,
    "round_current" INTEGER NOT NULL DEFAULT 1,
    "rest_between_exercises_seconds" INTEGER NOT NULL DEFAULT 0,
    "rest_after_round_seconds" INTEGER NOT NULL DEFAULT 0,
    "rest_after_set_seconds" INTEGER,

    CONSTRAINT "WorkoutGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExerciseItem" (
    "id" TEXT NOT NULL,
    "workout_group_id" TEXT NOT NULL,
    "source_group_exercise_id" TEXT NOT NULL,
    "exercise_id_override" TEXT,
    "order_in_group" TEXT NOT NULL,
    "target_sets_total" INTEGER NOT NULL,
    "rep_range" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "WorkoutExerciseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSet" (
    "id" TEXT NOT NULL,
    "workout_exercise_item_id" TEXT NOT NULL,
    "set_number" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "reps" INTEGER,
    "rpe" DOUBLE PRECISION,
    "completed_at" TIMESTAMP(3),
    "is_done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WorkoutSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutProcessedEvent" (
    "session_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutProcessedEvent_pkey" PRIMARY KEY ("session_id","event_id")
);

-- CreateTable
CREATE TABLE "UserExercisePreference" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "exercise_id" TEXT,
    "exercise_family" TEXT,
    "preference_type" "PreferenceType" NOT NULL,
    "reason" "PreferenceReason" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserExercisePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExerciseSwap" (
    "id" TEXT NOT NULL,
    "workout_session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "original_exercise_id" TEXT NOT NULL,
    "replacement_exercise_id" TEXT NOT NULL,
    "reason" "SwapReason" NOT NULL,
    "saved_preference" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutExerciseSwap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRecommendationLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "coach_id" TEXT,
    "request_payload" JSONB NOT NULL,
    "response_payload" JSONB NOT NULL,
    "safety_flags" TEXT[],
    "request_hash" TEXT,
    "dedup_hit" BOOLEAN NOT NULL DEFAULT false,
    "rate_limited" BOOLEAN NOT NULL DEFAULT false,
    "latency_ms" INTEGER,
    "model_version" TEXT NOT NULL,
    "strategy_version" TEXT NOT NULL DEFAULT '3.2.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRecommendationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAppliedSuggestion" (
    "id" TEXT NOT NULL,
    "ai_log_id" TEXT NOT NULL,
    "routine_id" TEXT NOT NULL,
    "routine_day_id" TEXT NOT NULL,
    "applied_by_user_id" TEXT NOT NULL,
    "applied_changes" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAppliedSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRoutineGenerationLog" (
    "id" TEXT NOT NULL,
    "request_id" TEXT,
    "user_id" TEXT NOT NULL,
    "generation_input" JSONB NOT NULL,
    "ai_output_raw" JSONB,
    "validation_errors" TEXT[],
    "final_routine" JSONB,
    "routine_id" TEXT,
    "repair_attempts" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "failure_stage" TEXT,
    "duration_ms" INTEGER,
    "model_name" TEXT,
    "prompt_chars" INTEGER,
    "response_chars" INTEGER,
    "seed_used" TEXT,
    "exercise_library_hash" TEXT,
    "quality_score" INTEGER,
    "quality_reasons" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRoutineGenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "priority_area" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "weeks_total" INTEGER NOT NULL,
    "milestones" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressCheckIn" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fatigue" INTEGER NOT NULL,
    "pain_location" TEXT NOT NULL,
    "sleep_quality" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "readiness_modifier" DOUBLE PRECISION NOT NULL,
    "block_volume_increases" BOOLEAN NOT NULL DEFAULT false,
    "avoid_overhead_pressing" BOOLEAN NOT NULL DEFAULT false,
    "reduce_squat_volume" BOOLEAN NOT NULL DEFAULT false,
    "reduce_hinge_compounds" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_canonical_slug_key" ON "Exercise"("canonical_slug");

-- CreateIndex
CREATE INDEX "Exercise_exercise_family_idx" ON "Exercise"("exercise_family");

-- CreateIndex
CREATE INDEX "Exercise_movement_pattern_primary_muscle_idx" ON "Exercise"("movement_pattern", "primary_muscle");

-- CreateIndex
CREATE INDEX "ExerciseMuscleRank_muscle_rank_idx" ON "ExerciseMuscleRank"("muscle", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseMuscleRank_exercise_id_muscle_key" ON "ExerciseMuscleRank"("exercise_id", "muscle");

-- CreateIndex
CREATE INDEX "ExerciseTranslation_exercise_id_idx" ON "ExerciseTranslation"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseTranslation_exercise_id_locale_key" ON "ExerciseTranslation"("exercise_id", "locale");

-- CreateIndex
CREATE INDEX "Routine_is_public_published_at_idx" ON "Routine"("is_public", "published_at");

-- CreateIndex
CREATE INDEX "RoutineReview_routine_id_created_at_idx" ON "RoutineReview"("routine_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineReview_routine_id_user_id_key" ON "RoutineReview"("routine_id", "user_id");

-- CreateIndex
CREATE INDEX "CoachFollow_coach_id_created_at_idx" ON "CoachFollow"("coach_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "CoachFollow_user_id_coach_id_key" ON "CoachFollow"("user_id", "coach_id");

-- CreateIndex
CREATE INDEX "RoutineAssignment_user_id_is_active_idx" ON "RoutineAssignment"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "RoutineAssignment_coach_id_is_active_idx" ON "RoutineAssignment"("coach_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineAssignment_coach_id_user_id_routine_id_key" ON "RoutineAssignment"("coach_id", "user_id", "routine_id");

-- CreateIndex
CREATE INDEX "UserExercisePreference_user_id_idx" ON "UserExercisePreference"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserExercisePreference_user_id_exercise_id_preference_type_key" ON "UserExercisePreference"("user_id", "exercise_id", "preference_type");

-- CreateIndex
CREATE INDEX "AiRecommendationLog_user_id_created_at_idx" ON "AiRecommendationLog"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "AiRecommendationLog_coach_id_created_at_idx" ON "AiRecommendationLog"("coach_id", "created_at");

-- CreateIndex
CREATE INDEX "AiRecommendationLog_request_hash_created_at_idx" ON "AiRecommendationLog"("request_hash", "created_at");

-- CreateIndex
CREATE INDEX "AiAppliedSuggestion_routine_id_routine_day_id_created_at_idx" ON "AiAppliedSuggestion"("routine_id", "routine_day_id", "created_at");

-- CreateIndex
CREATE INDEX "AiAppliedSuggestion_ai_log_id_created_at_idx" ON "AiAppliedSuggestion"("ai_log_id", "created_at");

-- CreateIndex
CREATE INDEX "AiRoutineGenerationLog_user_id_created_at_idx" ON "AiRoutineGenerationLog"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "AiRoutineGenerationLog_request_id_idx" ON "AiRoutineGenerationLog"("request_id");

-- CreateIndex
CREATE INDEX "TrainingPlan_user_id_idx" ON "TrainingPlan"("user_id");

-- CreateIndex
CREATE INDEX "ProgressCheckIn_user_id_idx" ON "ProgressCheckIn"("user_id");

-- CreateIndex
CREATE INDEX "ProgressCheckIn_user_id_created_at_idx" ON "ProgressCheckIn"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_active_routine_id_fkey" FOREIGN KEY ("active_routine_id") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMuscleRank" ADD CONSTRAINT "ExerciseMuscleRank_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseTranslation" ADD CONSTRAINT "ExerciseTranslation_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineReview" ADD CONSTRAINT "RoutineReview_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineReview" ADD CONSTRAINT "RoutineReview_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachFollow" ADD CONSTRAINT "CoachFollow_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachFollow" ADD CONSTRAINT "CoachFollow_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineDay" ADD CONSTRAINT "RoutineDay_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseGroup" ADD CONSTRAINT "ExerciseGroup_routine_day_id_fkey" FOREIGN KEY ("routine_day_id") REFERENCES "RoutineDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupExercise" ADD CONSTRAINT "GroupExercise_exercise_group_id_fkey" FOREIGN KEY ("exercise_group_id") REFERENCES "ExerciseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupExercise" ADD CONSTRAINT "GroupExercise_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineAssignment" ADD CONSTRAINT "RoutineAssignment_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineAssignment" ADD CONSTRAINT "RoutineAssignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineAssignment" ADD CONSTRAINT "RoutineAssignment_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "Routine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_routine_day_id_fkey" FOREIGN KEY ("routine_day_id") REFERENCES "RoutineDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutGroup" ADD CONSTRAINT "WorkoutGroup_workout_session_id_fkey" FOREIGN KEY ("workout_session_id") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExerciseItem" ADD CONSTRAINT "WorkoutExerciseItem_workout_group_id_fkey" FOREIGN KEY ("workout_group_id") REFERENCES "WorkoutGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSet" ADD CONSTRAINT "WorkoutSet_workout_exercise_item_id_fkey" FOREIGN KEY ("workout_exercise_item_id") REFERENCES "WorkoutExerciseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutProcessedEvent" ADD CONSTRAINT "WorkoutProcessedEvent_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExercisePreference" ADD CONSTRAINT "UserExercisePreference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRecommendationLog" ADD CONSTRAINT "AiRecommendationLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRecommendationLog" ADD CONSTRAINT "AiRecommendationLog_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAppliedSuggestion" ADD CONSTRAINT "AiAppliedSuggestion_ai_log_id_fkey" FOREIGN KEY ("ai_log_id") REFERENCES "AiRecommendationLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAppliedSuggestion" ADD CONSTRAINT "AiAppliedSuggestion_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAppliedSuggestion" ADD CONSTRAINT "AiAppliedSuggestion_routine_day_id_fkey" FOREIGN KEY ("routine_day_id") REFERENCES "RoutineDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAppliedSuggestion" ADD CONSTRAINT "AiAppliedSuggestion_applied_by_user_id_fkey" FOREIGN KEY ("applied_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRoutineGenerationLog" ADD CONSTRAINT "AiRoutineGenerationLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRoutineGenerationLog" ADD CONSTRAINT "AiRoutineGenerationLog_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressCheckIn" ADD CONSTRAINT "ProgressCheckIn_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

