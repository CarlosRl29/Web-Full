-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'COACH', 'ADMIN');

-- CreateEnum
CREATE TYPE "ExerciseGroupType" AS ENUM ('SINGLE', 'SUPERSET_2', 'SUPERSET_3');

-- CreateEnum
CREATE TYPE "WorkoutSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FINISHED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "refresh_token_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscle_group" TEXT NOT NULL,
    "equipment" TEXT,
    "instructions" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
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
    "rep_range" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "GroupExercise_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineDay" ADD CONSTRAINT "RoutineDay_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseGroup" ADD CONSTRAINT "ExerciseGroup_routine_day_id_fkey" FOREIGN KEY ("routine_day_id") REFERENCES "RoutineDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupExercise" ADD CONSTRAINT "GroupExercise_exercise_group_id_fkey" FOREIGN KEY ("exercise_group_id") REFERENCES "ExerciseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupExercise" ADD CONSTRAINT "GroupExercise_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
