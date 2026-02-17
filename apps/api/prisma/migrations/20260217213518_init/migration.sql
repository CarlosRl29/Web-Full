-- AlterTable
ALTER TABLE "GroupExercise" ADD COLUMN     "rep_range_max" INTEGER,
ADD COLUMN     "rep_range_min" INTEGER;

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
CREATE TABLE "WorkoutProcessedEvent" (
    "session_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutProcessedEvent_pkey" PRIMARY KEY ("session_id","event_id")
);

-- CreateIndex
CREATE INDEX "RoutineAssignment_user_id_is_active_idx" ON "RoutineAssignment"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "RoutineAssignment_coach_id_is_active_idx" ON "RoutineAssignment"("coach_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineAssignment_coach_id_user_id_routine_id_key" ON "RoutineAssignment"("coach_id", "user_id", "routine_id");

-- AddForeignKey
ALTER TABLE "RoutineAssignment" ADD CONSTRAINT "RoutineAssignment_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineAssignment" ADD CONSTRAINT "RoutineAssignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineAssignment" ADD CONSTRAINT "RoutineAssignment_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutProcessedEvent" ADD CONSTRAINT "WorkoutProcessedEvent_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
