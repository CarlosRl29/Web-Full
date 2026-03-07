-- CreateTable
CREATE TABLE "ExerciseMuscleRank" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "muscle" "MuscleGroup" NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "ExerciseMuscleRank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseMuscleRank_muscle_rank_idx" ON "ExerciseMuscleRank"("muscle", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseMuscleRank_exercise_id_muscle_key" ON "ExerciseMuscleRank"("exercise_id", "muscle");

-- AddForeignKey
ALTER TABLE "ExerciseMuscleRank" ADD CONSTRAINT "ExerciseMuscleRank_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
