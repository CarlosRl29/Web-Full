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
CREATE INDEX "ProgressCheckIn_user_id_idx" ON "ProgressCheckIn"("user_id");

-- CreateIndex
CREATE INDEX "ProgressCheckIn_user_id_created_at_idx" ON "ProgressCheckIn"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ProgressCheckIn" ADD CONSTRAINT "ProgressCheckIn_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
