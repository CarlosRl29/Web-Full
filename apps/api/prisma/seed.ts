import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * AXION v2 minimal core seed:
 * - Admin user
 * - 50 golden exercises with ES/EN translations
 */

type MuscleGroup =
  | "CHEST"
  | "BACK"
  | "SHOULDERS"
  | "BICEPS"
  | "TRICEPS"
  | "QUADS"
  | "HAMSTRINGS"
  | "GLUTES"
  | "CALVES"
  | "CORE";

type GoldenExercise = {
  slug: string;
  nameEn: string;
  nameEs: string;
  muscle: MuscleGroup;
  submuscle?: string;
  equipment: string;
  instructionsEn: string;
  instructionsEs: string;
};

const GOLDEN_EXERCISES: GoldenExercise[] = [
  // CHEST (5)
  {
    slug: "bench_press",
    nameEn: "Bench Press",
    nameEs: "Press de banca",
    muscle: "CHEST",
    submuscle: "MID_CHEST",
    equipment: "Barbell",
    instructionsEn: "Lie on bench, grip bar slightly wider than shoulders. Lower to chest, press up.",
    instructionsEs: "Acostado en banco, agarre un poco más ancho que hombros. Baja al pecho, empuja."
  },
  {
    slug: "incline_bench_press",
    nameEn: "Incline Bench Press",
    nameEs: "Press inclinado",
    muscle: "CHEST",
    submuscle: "UPPER_CHEST",
    equipment: "Barbell",
    instructionsEn: "Set bench to 30-45°. Same as flat bench, press from upper chest.",
    instructionsEs: "Banco a 30-45°. Igual que plano, empuja desde pectoral superior."
  },
  {
    slug: "dumbbell_bench_press",
    nameEn: "Dumbbell Bench Press",
    nameEs: "Press con mancuernas",
    muscle: "CHEST",
    equipment: "Dumbbell",
    instructionsEn: "Lie on bench, dumbbells at shoulder level. Press up, control descent.",
    instructionsEs: "Acostado, mancuernas a altura de hombros. Empuja, controla el descenso."
  },
  {
    slug: "push_up",
    nameEn: "Push Up",
    nameEs: "Flexiones",
    muscle: "CHEST",
    equipment: "Bodyweight",
    instructionsEn: "Plank position, hands shoulder-width. Lower chest to floor, push back up.",
    instructionsEs: "Posición plancha, manos al ancho de hombros. Baja el pecho al suelo, empuja."
  },
  {
    slug: "cable_fly",
    nameEn: "Cable Fly",
    nameEs: "Aperturas en polea",
    muscle: "CHEST",
    equipment: "Cable",
    instructionsEn: "Stand between cables, arms extended. Bring handles together in front of chest.",
    instructionsEs: "Entre poleas, brazos extendidos. Junta los agarres frente al pecho."
  },
  // BACK (5)
  {
    slug: "barbell_row",
    nameEn: "Barbell Row",
    nameEs: "Remo con barra",
    muscle: "BACK",
    submuscle: "LATS",
    equipment: "Barbell",
    instructionsEn: "Hinge at hips, bar to lower chest. Squeeze shoulder blades.",
    instructionsEs: "Bisagra en caderas, barra al pecho bajo. Aprieta escápulas."
  },
  {
    slug: "lat_pulldown",
    nameEn: "Lat Pulldown",
    nameEs: "Jalón al pecho",
    muscle: "BACK",
    submuscle: "LATS",
    equipment: "Cable",
    instructionsEn: "Grip bar wide, pull to upper chest. Control the negative.",
    instructionsEs: "Agarre ancho, tira al pecho alto. Controla la fase negativa."
  },
  {
    slug: "pull_up",
    nameEn: "Pull Up",
    nameEs: "Dominadas",
    muscle: "BACK",
    submuscle: "LATS",
    equipment: "Bodyweight",
    instructionsEn: "Hang from bar, pull chin over bar. Full range of motion.",
    instructionsEs: "Colgado de la barra, sube la barbilla por encima. Rango completo."
  },
  {
    slug: "deadlift",
    nameEn: "Deadlift",
    nameEs: "Peso muerto",
    muscle: "BACK",
    submuscle: "LOWER_BACK",
    equipment: "Barbell",
    instructionsEn: "Hinge at hips, neutral spine. Drive through heels to stand.",
    instructionsEs: "Bisagra en caderas, columna neutra. Empuja con talones para levantar."
  },
  {
    slug: "seated_cable_row",
    nameEn: "Seated Cable Row",
    nameEs: "Remo sentado en polea",
    muscle: "BACK",
    submuscle: "MID_BACK",
    equipment: "Cable",
    instructionsEn: "Sit, pull handle to belly. Squeeze back, avoid momentum.",
    instructionsEs: "Sentado, tira del agarre al vientre. Aprieta espalda, sin impulso."
  },
  // SHOULDERS (5)
  {
    slug: "overhead_press",
    nameEn: "Overhead Press",
    nameEs: "Press militar",
    muscle: "SHOULDERS",
    submuscle: "ANTERIOR_DELTOID",
    equipment: "Barbell",
    instructionsEn: "Bar at shoulders, press overhead. Lock out at top.",
    instructionsEs: "Barra en hombros, empuja arriba. Bloquea arriba."
  },
  {
    slug: "dumbbell_shoulder_press",
    nameEn: "Dumbbell Shoulder Press",
    nameEs: "Press de hombros con mancuernas",
    muscle: "SHOULDERS",
    equipment: "Dumbbell",
    instructionsEn: "Dumbbells at shoulders, press up. Slight arch in lower back.",
    instructionsEs: "Mancuernas en hombros, empuja arriba. Ligera arqueo lumbar."
  },
  {
    slug: "lateral_raise",
    nameEn: "Lateral Raise",
    nameEs: "Elevaciones laterales",
    muscle: "SHOULDERS",
    submuscle: "LATERAL_DELTOID",
    equipment: "Dumbbell",
    instructionsEn: "Arms at sides, raise to shoulder height. Control descent.",
    instructionsEs: "Brazos a los lados, eleva a altura de hombros. Controla el descenso."
  },
  {
    slug: "face_pull",
    nameEn: "Face Pull",
    nameEs: "Face pull",
    muscle: "SHOULDERS",
    submuscle: "REAR_DELTOID",
    equipment: "Cable",
    instructionsEn: "Pull rope to face, elbows out. Squeeze rear delts.",
    instructionsEs: "Tira la cuerda a la cara, codos afuera. Aprieta deltoides posteriores."
  },
  {
    slug: "arnold_press",
    nameEn: "Arnold Press",
    nameEs: "Press Arnold",
    muscle: "SHOULDERS",
    equipment: "Dumbbell",
    instructionsEn: "Start palms in, rotate out as you press. Full ROM.",
    instructionsEs: "Empieza palmas hacia dentro, rota al empujar. ROM completo."
  },
  // BICEPS (5)
  {
    slug: "barbell_curl",
    nameEn: "Barbell Curl",
    nameEs: "Curl con barra",
    muscle: "BICEPS",
    equipment: "Barbell",
    instructionsEn: "Arms extended, curl bar to shoulders. Squeeze biceps at top.",
    instructionsEs: "Brazos extendidos, curl hasta hombros. Aprieta bíceps arriba."
  },
  {
    slug: "dumbbell_curl",
    nameEn: "Dumbbell Curl",
    nameEs: "Curl con mancuernas",
    muscle: "BICEPS",
    equipment: "Dumbbell",
    instructionsEn: "Alternate or together, curl to shoulders. Full extension at bottom.",
    instructionsEs: "Alternado o juntos, curl a hombros. Extensión completa abajo."
  },
  {
    slug: "hammer_curl",
    nameEn: "Hammer Curl",
    nameEs: "Curl martillo",
    muscle: "BICEPS",
    equipment: "Dumbbell",
    instructionsEn: "Neutral grip, curl to shoulders. Targets brachialis.",
    instructionsEs: "Agarre neutro, curl a hombros. Trabaja braquial."
  },
  {
    slug: "preacher_curl",
    nameEn: "Preacher Curl",
    nameEs: "Curl en banco Scott",
    muscle: "BICEPS",
    equipment: "Barbell",
    instructionsEn: "Arms on pad, curl bar up. Strict form, no swing.",
    instructionsEs: "Brazos en almohadilla, curl de barra. Forma estricta."
  },
  {
    slug: "cable_curl",
    nameEn: "Cable Curl",
    nameEs: "Curl en polea",
    muscle: "BICEPS",
    equipment: "Cable",
    instructionsEn: "Stand at cable, curl handle to shoulders. Constant tension.",
    instructionsEs: "De pie en polea, curl del agarre a hombros. Tensión constante."
  },
  // TRICEPS (5)
  {
    slug: "tricep_pushdown",
    nameEn: "Tricep Pushdown",
    nameEs: "Extensión de tríceps en polea",
    muscle: "TRICEPS",
    equipment: "Cable",
    instructionsEn: "Push bar down, extend elbows. Squeeze triceps at bottom.",
    instructionsEs: "Empuja la barra abajo, extiende codos. Aprieta tríceps abajo."
  },
  {
    slug: "skull_crusher",
    nameEn: "Skull Crusher",
    nameEs: "Extensión de tríceps acostado",
    muscle: "TRICEPS",
    equipment: "Barbell",
    instructionsEn: "Lie on bench, lower bar to forehead. Extend elbows.",
    instructionsEs: "Acostado, baja la barra a la frente. Extiende codos."
  },
  {
    slug: "close_grip_bench_press",
    nameEn: "Close Grip Bench Press",
    nameEs: "Press de banca agarre cerrado",
    muscle: "TRICEPS",
    equipment: "Barbell",
    instructionsEn: "Hands shoulder-width or closer. Lower to lower chest, press.",
    instructionsEs: "Manos al ancho de hombros o menos. Baja al pecho bajo, empuja."
  },
  {
    slug: "tricep_dips",
    nameEn: "Tricep Dips",
    nameEs: "Fondos en paralelas",
    muscle: "TRICEPS",
    equipment: "Bodyweight",
    instructionsEn: "Support on parallel bars, lower until upper arms parallel. Push up.",
    instructionsEs: "Apoyo en paralelas, baja hasta brazos paralelos. Empuja."
  },
  {
    slug: "overhead_tricep_extension",
    nameEn: "Overhead Tricep Extension",
    nameEs: "Extensión de tríceps por encima",
    muscle: "TRICEPS",
    equipment: "Dumbbell",
    instructionsEn: "Dumbbell behind head, extend elbows. Stretch at bottom.",
    instructionsEs: "Mancuerna detrás de la cabeza, extiende codos. Estira abajo."
  },
  // QUADS (5)
  {
    slug: "barbell_squat",
    nameEn: "Barbell Squat",
    nameEs: "Sentadilla con barra",
    muscle: "QUADS",
    equipment: "Barbell",
    instructionsEn: "Bar on upper back, squat to parallel or below. Drive through heels.",
    instructionsEs: "Barra en espalda alta, sentadilla a paralelo o más. Empuja con talones."
  },
  {
    slug: "leg_press",
    nameEn: "Leg Press",
    nameEs: "Prensa de piernas",
    muscle: "QUADS",
    equipment: "Machine",
    instructionsEn: "Feet on platform, lower until 90°. Press through heels.",
    instructionsEs: "Pies en plataforma, baja hasta 90°. Empuja con talones."
  },
  {
    slug: "leg_extension",
    nameEn: "Leg Extension",
    nameEs: "Extensión de cuádriceps",
    muscle: "QUADS",
    equipment: "Machine",
    instructionsEn: "Sit, extend legs. Squeeze quads at top, control descent.",
    instructionsEs: "Sentado, extiende piernas. Aprieta cuádriceps arriba."
  },
  {
    slug: "front_squat",
    nameEn: "Front Squat",
    nameEs: "Sentadilla frontal",
    muscle: "QUADS",
    equipment: "Barbell",
    instructionsEn: "Bar on front delts, elbows high. Squat keeping torso upright.",
    instructionsEs: "Barra en deltoides frontales, codos altos. Sentadilla torso erguido."
  },
  {
    slug: "goblet_squat",
    nameEn: "Goblet Squat",
    nameEs: "Sentadilla tipo goblet",
    muscle: "QUADS",
    equipment: "Dumbbell",
    instructionsEn: "Hold dumbbell at chest, squat deep. Elbows between knees.",
    instructionsEs: "Mancuerna al pecho, sentadilla profunda. Codos entre rodillas."
  },
  // HAMSTRINGS (5)
  {
    slug: "romanian_deadlift",
    nameEn: "Romanian Deadlift",
    nameEs: "Peso muerto rumano",
    muscle: "HAMSTRINGS",
    equipment: "Barbell",
    instructionsEn: "Slight knee bend, hinge at hips. Feel hamstring stretch.",
    instructionsEs: "Ligera flexión de rodilla, bisagra en caderas. Siente estiramiento."
  },
  {
    slug: "leg_curl",
    nameEn: "Leg Curl",
    nameEs: "Curl de piernas",
    muscle: "HAMSTRINGS",
    equipment: "Machine",
    instructionsEn: "Lie or sit, curl heels to glutes. Squeeze hamstrings.",
    instructionsEs: "Tumbado o sentado, curl de talones a glúteos. Aprieta isquiotibiales."
  },
  {
    slug: "stiff_leg_deadlift",
    nameEn: "Stiff Leg Deadlift",
    nameEs: "Peso muerto piernas rígidas",
    muscle: "HAMSTRINGS",
    equipment: "Barbell",
    instructionsEn: "Legs nearly straight, hinge at hips. Lower bar along legs.",
    instructionsEs: "Piernas casi rectas, bisagra en caderas. Baja barra por piernas."
  },
  {
    slug: "good_morning",
    nameEn: "Good Morning",
    nameEs: "Good morning",
    muscle: "HAMSTRINGS",
    equipment: "Barbell",
    instructionsEn: "Bar on back, hinge at hips. Keep back flat.",
    instructionsEs: "Barra en espalda, bisagra en caderas. Espalda plana."
  },
  {
    slug: "lying_leg_curl",
    nameEn: "Lying Leg Curl",
    nameEs: "Curl tumbado",
    muscle: "HAMSTRINGS",
    equipment: "Machine",
    instructionsEn: "Lie face down, curl pad to glutes. Control negative.",
    instructionsEs: "Tumbado boca abajo, curl del rodillo a glúteos. Controla negativa."
  },
  // GLUTES (5)
  {
    slug: "hip_thrust",
    nameEn: "Hip Thrust",
    nameEs: "Hip thrust",
    muscle: "GLUTES",
    equipment: "Barbell",
    instructionsEn: "Upper back on bench, drive hips up. Squeeze glutes at top.",
    instructionsEs: "Espalda alta en banco, empuja caderas arriba. Aprieta glúteos arriba."
  },
  {
    slug: "glute_bridge",
    nameEn: "Glute Bridge",
    nameEs: "Puente de glúteos",
    muscle: "GLUTES",
    equipment: "Bodyweight",
    instructionsEn: "Feet flat, drive hips up. Squeeze glutes, hold at top.",
    instructionsEs: "Pies planos, empuja caderas arriba. Aprieta glúteos, mantén arriba."
  },
  {
    slug: "bulgarian_split_squat",
    nameEn: "Bulgarian Split Squat",
    nameEs: "Sentadilla búlgara",
    muscle: "GLUTES",
    equipment: "Dumbbell",
    instructionsEn: "Rear foot elevated, lunge down. Front knee over toe.",
    instructionsEs: "Pie trasero elevado, baja en zancada. Rodilla delante sobre el pie."
  },
  {
    slug: "lunge",
    nameEn: "Lunge",
    nameEs: "Zancada",
    muscle: "GLUTES",
    equipment: "Dumbbell",
    instructionsEn: "Step forward, lower back knee toward floor. Drive back up.",
    instructionsEs: "Paso adelante, baja rodilla trasera al suelo. Empuja para subir."
  },
  {
    slug: "cable_kickback",
    nameEn: "Cable Kickback",
    nameEs: "Patada en polea",
    muscle: "GLUTES",
    equipment: "Cable",
    instructionsEn: "Hinge forward, extend leg back. Squeeze glute at top.",
    instructionsEs: "Inclínate, extiende pierna atrás. Aprieta glúteo arriba."
  },
  // CALVES (5)
  {
    slug: "standing_calf_raise",
    nameEn: "Standing Calf Raise",
    nameEs: "Elevación de gemelos de pie",
    muscle: "CALVES",
    equipment: "Machine",
    instructionsEn: "Stand on platform, raise onto toes. Full stretch at bottom.",
    instructionsEs: "De pie en plataforma, sube de puntillas. Estira abajo."
  },
  {
    slug: "seated_calf_raise",
    nameEn: "Seated Calf Raise",
    nameEs: "Elevación de gemelos sentado",
    muscle: "CALVES",
    equipment: "Machine",
    instructionsEn: "Sit, raise onto toes. Targets soleus.",
    instructionsEs: "Sentado, sube de puntillas. Trabaja sóleo."
  },
  {
    slug: "leg_press_calf_raise",
    nameEn: "Leg Press Calf Raise",
    nameEs: "Gemelos en prensa",
    muscle: "CALVES",
    equipment: "Machine",
    instructionsEn: "Feet on platform edge, press and raise onto toes.",
    instructionsEs: "Pies en borde de plataforma, presiona y sube de puntillas."
  },
  {
    slug: "donkey_calf_raise",
    nameEn: "Donkey Calf Raise",
    nameEs: "Elevación de gemelos burro",
    muscle: "CALVES",
    equipment: "Bodyweight",
    instructionsEn: "Bent at hips, raise onto toes. Partner or machine for load.",
    instructionsEs: "Inclinado en caderas, sube de puntillas. Compañero o máquina."
  },
  {
    slug: "single_leg_calf_raise",
    nameEn: "Single Leg Calf Raise",
    nameEs: "Elevación de gemelos a una pierna",
    muscle: "CALVES",
    equipment: "Bodyweight",
    instructionsEn: "Balance on one foot, raise onto toes. Hold wall for balance.",
    instructionsEs: "Equilibrio en un pie, sube de puntillas. Sujétate a la pared."
  },
  // CORE (5)
  {
    slug: "plank",
    nameEn: "Plank",
    nameEs: "Plancha",
    muscle: "CORE",
    submuscle: "ABS",
    equipment: "Bodyweight",
    instructionsEn: "Forearms on floor, body straight. Hold position.",
    instructionsEs: "Antebrazos en suelo, cuerpo recto. Mantén la posición."
  },
  {
    slug: "dead_bug",
    nameEn: "Dead Bug",
    nameEs: "Bicho muerto",
    muscle: "CORE",
    submuscle: "ABS",
    equipment: "Bodyweight",
    instructionsEn: "On back, extend opposite arm and leg. Keep lower back pressed.",
    instructionsEs: "Boca arriba, extiende brazo y pierna opuestos. Espalda baja pegada."
  },
  {
    slug: "bicycle_crunch",
    nameEn: "Bicycle Crunch",
    nameEs: "Crunch bicicleta",
    muscle: "CORE",
    submuscle: "ABS",
    equipment: "Bodyweight",
    instructionsEn: "Touch elbow to opposite knee, alternate. Controlled tempo.",
    instructionsEs: "Toca codo con rodilla opuesta, alterna. Tiempo controlado."
  },
  {
    slug: "hanging_leg_raise",
    nameEn: "Hanging Leg Raise",
    nameEs: "Elevación de piernas colgado",
    muscle: "CORE",
    submuscle: "ABS",
    equipment: "Bodyweight",
    instructionsEn: "Hang from bar, raise legs to 90°. Control the negative.",
    instructionsEs: "Colgado, sube piernas a 90°. Controla la negativa."
  },
  {
    slug: "russian_twist",
    nameEn: "Russian Twist",
    nameEs: "Giros rusos",
    muscle: "CORE",
    submuscle: "OBLIQUES",
    equipment: "Bodyweight",
    instructionsEn: "Seated, rotate torso side to side. Add weight for progression.",
    instructionsEs: "Sentado, rota torso de lado a lado. Añade peso para progresar."
  }
];

async function main() {
  const adminEmail =
    process.env.SEED_ADMIN_EMAIL ?? "admin@gym.local";
  const adminPasswordPlain =
    process.env.SEED_ADMIN_PASSWORD ?? "Admin1234";
  if (
    process.env.NODE_ENV === "production" &&
    (adminPasswordPlain === "Admin1234" || adminEmail === "admin@gym.local")
  ) {
    throw new Error(
      "Production seed requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD env vars. Do not use default credentials."
    );
  }
  const adminPassword = await bcrypt.hash(adminPasswordPlain, 10);

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

  // Clear existing exercises (seed idempotent: re-run replaces)
  await prisma.exerciseTranslation.deleteMany({});
  await prisma.exerciseMuscleRank.deleteMany({});
  await prisma.groupExercise.deleteMany({});
  await prisma.exercise.deleteMany({});

  for (const ex of GOLDEN_EXERCISES) {
    const created = await prisma.exercise.create({
      data: {
        name: ex.nameEn,
        canonical_slug: ex.slug,
        muscle_group: ex.muscle.toLowerCase(),
        primary_muscle: ex.muscle,
        primary_submuscle: ex.submuscle ? (ex.submuscle as import("@prisma/client").Submuscle) : undefined,
        equipment: ex.equipment,
        instructions: ex.instructionsEn,
        source: "seed"
      }
    });

    await prisma.exerciseTranslation.upsert({
      where: {
        exercise_id_locale: { exercise_id: created.id, locale: "en" }
      },
      update: { name: ex.nameEn, short_description: ex.instructionsEn },
      create: {
        exercise_id: created.id,
        locale: "en",
        name: ex.nameEn,
        short_description: ex.instructionsEn
      }
    });

    await prisma.exerciseTranslation.upsert({
      where: {
        exercise_id_locale: { exercise_id: created.id, locale: "es" }
      },
      update: { name: ex.nameEs, short_description: ex.instructionsEs },
      create: {
        exercise_id: created.id,
        locale: "es",
        name: ex.nameEs,
        short_description: ex.instructionsEs
      }
    });
  }

  console.log(`Seed complete: admin user + ${GOLDEN_EXERCISES.length} exercises (es/en)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
