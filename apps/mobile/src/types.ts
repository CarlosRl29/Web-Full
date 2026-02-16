export type Pointer = {
  group_index: number;
  exercise_index: number;
  set_index: number;
  round_index: number;
};

export type WorkoutSet = {
  id: string;
  set_number: number;
  weight?: number | null;
  reps?: number | null;
  rpe?: number | null;
  is_done: boolean;
};

export type WorkoutExerciseItem = {
  id: string;
  order_in_group: "A1" | "A2" | "A3";
  target_sets_total: number;
  rep_range: string;
  notes?: string | null;
  sets: WorkoutSet[];
};

export type WorkoutGroup = {
  id: string;
  type: "SINGLE" | "SUPERSET_2" | "SUPERSET_3";
  order_index: number;
  rounds_total: number;
  round_current: number;
  rest_between_exercises_seconds: number;
  rest_after_round_seconds: number;
  rest_after_set_seconds?: number | null;
  workout_items: WorkoutExerciseItem[];
};

export type ActiveSession = {
  id: string;
  current_pointer: Pointer;
  workout_groups: WorkoutGroup[];
};
