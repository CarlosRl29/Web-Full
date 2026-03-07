/**
 * Elimina TODOS los ejercicios de la base de datos.
 * Cuidado: las rutinas que referencien ejercicios pueden fallar.
 *
 * Preferir: API DELETE /admin/exercises/clear (como admin)
 * O ejecutar: npm run remove-all-exercises -w apps/api
 */

import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  const groupExerciseCount = await prisma.groupExercise.count();
  if (groupExerciseCount > 0) {
    console.log("Eliminando referencias en GroupExercise...");
    await prisma.groupExercise.deleteMany({});
  }

  const count = await prisma.exercise.count();
  console.log(`Eliminando ${count} ejercicios...`);
  await prisma.exercise.deleteMany({});
  console.log("Listo. Todos los ejercicios eliminados.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
