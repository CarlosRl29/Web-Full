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

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN "primary_muscle" "MuscleGroup",
ADD COLUMN "primary_submuscle" "Submuscle",
ADD COLUMN "secondary_muscles" "MuscleGroup"[] DEFAULT ARRAY[]::"MuscleGroup"[],
ADD COLUMN "movement_pattern" "MovementPattern",
ADD COLUMN "exercise_type" "ExerciseType",
ADD COLUMN "difficulty" "ExerciseDifficulty";
