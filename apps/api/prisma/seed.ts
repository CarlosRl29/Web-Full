import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@gym.local";
  const adminPassword = await bcrypt.hash("Admin1234", 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      full_name: "Gym Admin",
      role: UserRole.ADMIN,
      password_hash: adminPassword
    }
  });

  const exercises = [
    { name: "Bench Press", muscle_group: "Chest", equipment: "Barbell" },
    { name: "Back Squat", muscle_group: "Legs", equipment: "Barbell" },
    { name: "Deadlift", muscle_group: "Posterior Chain", equipment: "Barbell" },
    { name: "Pull Up", muscle_group: "Back", equipment: "Bodyweight" },
    { name: "Overhead Press", muscle_group: "Shoulders", equipment: "Barbell" },
    { name: "Dumbbell Row", muscle_group: "Back", equipment: "Dumbbell" },
    { name: "Biceps Curl", muscle_group: "Biceps", equipment: "Dumbbell" }
  ];

  for (const exercise of exercises) {
    await prisma.exercise.upsert({
      where: { name: exercise.name },
      update: exercise,
      create: exercise
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
