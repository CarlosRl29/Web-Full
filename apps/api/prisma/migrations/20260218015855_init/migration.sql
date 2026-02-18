-- CreateEnum
CREATE TYPE "UserMode" AS ENUM ('USER', 'COACH');

-- CreateEnum
CREATE TYPE "TrainingGoal" AS ENUM ('STRENGTH', 'HYPERTROPHY', 'MIXED');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketplace_days_per_week" INTEGER,
ADD COLUMN     "marketplace_description" TEXT,
ADD COLUMN     "marketplace_duration_weeks" INTEGER,
ADD COLUMN     "marketplace_goal" TEXT,
ADD COLUMN     "marketplace_level" TEXT,
ADD COLUMN     "marketplace_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "marketplace_title" TEXT,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "rating_average" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active_mode" "UserMode" NOT NULL DEFAULT 'USER',
ADD COLUMN     "active_routine_id" TEXT,
ADD COLUMN     "days_per_week" INTEGER,
ADD COLUMN     "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "experience_level" "ExperienceLevel",
ADD COLUMN     "goal" "TrainingGoal",
ADD COLUMN     "injuries" TEXT,
ADD COLUMN     "preferred_modes" "UserMode"[] DEFAULT ARRAY['USER']::"UserMode"[],
ADD COLUMN     "session_minutes" INTEGER;

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

-- CreateIndex
CREATE INDEX "RoutineReview_routine_id_created_at_idx" ON "RoutineReview"("routine_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineReview_routine_id_user_id_key" ON "RoutineReview"("routine_id", "user_id");

-- CreateIndex
CREATE INDEX "CoachFollow_coach_id_created_at_idx" ON "CoachFollow"("coach_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "CoachFollow_user_id_coach_id_key" ON "CoachFollow"("user_id", "coach_id");

-- CreateIndex
CREATE INDEX "Routine_is_public_published_at_idx" ON "Routine"("is_public", "published_at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_active_routine_id_fkey" FOREIGN KEY ("active_routine_id") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineReview" ADD CONSTRAINT "RoutineReview_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineReview" ADD CONSTRAINT "RoutineReview_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachFollow" ADD CONSTRAINT "CoachFollow_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachFollow" ADD CONSTRAINT "CoachFollow_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
