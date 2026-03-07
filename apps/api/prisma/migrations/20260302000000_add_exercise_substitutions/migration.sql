-- CreateEnum
CREATE TYPE "SwapReason" AS ENUM ('EQUIPMENT_BUSY', 'NOT_AVAILABLE', 'PAIN', 'PREFERENCE', 'TOO_HARD');

-- CreateEnum
CREATE TYPE "PreferenceType" AS ENUM ('AVOID', 'PREFER');

-- CreateEnum
CREATE TYPE "PreferenceReason" AS ENUM ('EQUIPMENT', 'PAIN', 'PREFERENCE', 'TOO_HARD');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN "exercise_family" TEXT;
ALTER TABLE "Exercise" ADD COLUMN "movement_pattern_secondary" "MovementPattern"[] DEFAULT ARRAY[]::"MovementPattern"[];

-- AlterTable
ALTER TABLE "WorkoutExerciseItem" ADD COLUMN "exercise_id_override" TEXT;

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

-- CreateIndex
CREATE INDEX "Exercise_exercise_family_idx" ON "Exercise"("exercise_family");

-- CreateIndex
CREATE INDEX "Exercise_movement_pattern_primary_muscle_idx" ON "Exercise"("movement_pattern", "primary_muscle");

-- CreateIndex
CREATE UNIQUE INDEX "UserExercisePreference_user_id_exercise_id_preference_type_key" ON "UserExercisePreference"("user_id", "exercise_id", "preference_type");

-- CreateIndex
CREATE INDEX "UserExercisePreference_user_id_idx" ON "UserExercisePreference"("user_id");

-- AddForeignKey
ALTER TABLE "UserExercisePreference" ADD CONSTRAINT "UserExercisePreference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
