/**
 * Elimina los ejercicios del seed original (español) que ya no se usan.
 * Los ejercicios de ExerciseDB (inglés) se mantienen.
 *
 * Uso: npx ts-node scripts/remove-old-seed-exercises.ts
 */

import { PrismaClient } from "@prisma/client";

const OLD_SEED_NAMES = [
  "Bench Press",
  "Press de banca inclinado",
  "Press de banca declinado",
  "Press de pecho con mancuernas",
  "Press inclinado con mancuernas",
  "Aperturas con mancuernas",
  "Aperturas en polea",
  "Fondos en paralelas",
  "Flexiones",
  "Press de pecho en máquina",
  "Cruces en polea alta",
  "Dominadas",
  "Jalón al pecho",
  "Jalón tras nuca",
  "Remo con barra",
  "Remo con mancuerna",
  "Remo en polea baja",
  "Remo en máquina",
  "Peso muerto convencional",
  "Peso muerto rumano",
  "Hiperextensiones",
  "Face pull",
  "Encogimientos con barra",
  "Press militar",
  "Press de hombros con mancuernas",
  "Press Arnold",
  "Elevaciones laterales",
  "Elevaciones laterales en polea",
  "Elevaciones frontales",
  "Pájaros inversos",
  "Pájaros en polea",
  "Press de hombros en máquina",
  "Curl con barra",
  "Curl con barra Z",
  "Curl con mancuernas",
  "Curl martillo",
  "Curl en polea baja",
  "Curl concentrado",
  "Curl predicador",
  "Curl en máquina",
  "Fondos en banco",
  "Press francés",
  "Extensiones de tríceps en polea",
  "Extensiones con mancuerna",
  "Extensiones con cuerda",
  "Press cerrado",
  "Patada de tríceps",
  "Sentadilla trasera",
  "Sentadilla frontal",
  "Sentadilla búlgara",
  "Prensa de piernas",
  "Extensión de cuádriceps",
  "Zancadas",
  "Hack squat",
  "Sentadilla goblet",
  "Peso muerto piernas rígidas",
  "Curl femoral tumbado",
  "Curl femoral sentado",
  "Peso muerto a una pierna",
  "Good morning",
  "Hip thrust",
  "Patada de glúteo en polea",
  "Abducción de cadera",
  "Puente de glúteos",
  "Prensa con pies altos",
  "Elevación de gemelos de pie",
  "Elevación de gemelos sentado",
  "Elevación de gemelos en prensa",
  "Elevación de gemelos con mancuerna",
  "Elevación de gemelos a una pierna",
  "Curl de muñeca",
  "Curl inverso de muñeca",
  "Curl de martillo inverso",
  "Crunch",
  "Crunch en polea",
  "Plancha",
  "Plancha lateral",
  "Elevación de piernas colgado",
  "Elevación de rodillas",
  "Russian twist",
  "Bicicleta",
  "Mountain climbers",
  "Dead bug",
  "Encogimientos con mancuernas",
  "Remo alto",
  "Remo al mentón",
  "Clean and press",
  "Snatch",
  "Thruster",
  "Burpees",
  "Kettlebell swing",
  "Peso muerto sumo"
];

async function main() {
  const prisma = new PrismaClient();
  let deleted = 0;

  for (const name of OLD_SEED_NAMES) {
    try {
      const result = await prisma.exercise.deleteMany({ where: { name } });
      deleted += result.count;
    } catch {
      // Ignorar si no existe
    }
  }

  console.log(`Eliminados ${deleted} ejercicios del seed antiguo.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
