/**
 * Curated top exercise slugs per muscle group.
 * Used to rank exercises when searching/filtering by muscle.
 * Slugs match canonical_slug format (lowercase, underscores).
 */
import type { MuscleGroup } from "./exercise-types";

export const TOP_RANKS_BY_MUSCLE: Record<MuscleGroup, string[]> = {
  CHEST: [
    "bench_press",
    "incline_bench_press",
    "dumbbell_bench_press",
    "incline_dumbbell_press",
    "chest_press_machine",
    "push_up",
    "dips",
    "cable_fly",
    "pec_deck",
    "dumbbell_fly"
  ],
  BACK: [
    "barbell_row",
    "dumbbell_row",
    "lat_pulldown",
    "pull_up",
    "deadlift",
    "t_bar_row",
    "seated_cable_row",
    "chin_up",
    "face_pull",
    "straight_arm_pulldown"
  ],
  SHOULDERS: [
    "overhead_press",
    "dumbbell_shoulder_press",
    "arnold_press",
    "lateral_raise",
    "front_raise",
    "face_pull",
    "reverse_pec_deck",
    "cable_lateral_raise",
    "upright_row",
    "barbell_front_raise"
  ],
  BICEPS: [
    "barbell_curl",
    "dumbbell_curl",
    "hammer_curl",
    "preacher_curl",
    "cable_curl",
    "concentration_curl",
    "incline_dumbbell_curl",
    "ez_bar_curl",
    "spider_curl",
    "reverse_curl"
  ],
  TRICEPS: [
    "tricep_pushdown",
    "skull_crusher",
    "close_grip_bench_press",
    "tricep_dips",
    "overhead_tricep_extension",
    "dumbbell_tricep_extension",
    "cable_tricep_pushdown",
    "lying_tricep_extension",
    "diamond_push_up",
    "rope_pushdown"
  ],
  QUADS: [
    "barbell_squat",
    "leg_press",
    "leg_extension",
    "front_squat",
    "hack_squat",
    "goblet_squat",
    "bulgarian_split_squat",
    "lunge",
    "sissy_squat",
    "v_squat"
  ],
  HAMSTRINGS: [
    "romanian_deadlift",
    "leg_curl",
    "stiff_leg_deadlift",
    "good_morning",
    "nordic_curl",
    "single_leg_romanian_deadlift",
    "lying_leg_curl",
    "seated_leg_curl",
    "glute_ham_raise",
    "cable_leg_curl"
  ],
  GLUTES: [
    "hip_thrust",
    "glute_bridge",
    "cable_kickback",
    "bulgarian_split_squat",
    "sumo_deadlift",
    "lunge",
    "step_up",
    "hip_abduction",
    "donkey_kick",
    "single_leg_hip_thrust"
  ],
  CALVES: [
    "standing_calf_raise",
    "seated_calf_raise",
    "donkey_calf_raise",
    "leg_press_calf_raise",
    "single_leg_calf_raise",
    "jump_rope",
    "calf_raise_on_leg_press",
    "toe_raise",
    "farmer_walk",
    "box_jump"
  ],
  CORE: [
    "plank",
    "dead_bug",
    "bicycle_crunch",
    "hanging_leg_raise",
    "ab_wheel_rollout",
    "russian_twist",
    "mountain_climber",
    "bird_dog",
    "cable_crunch",
    "pallof_press"
  ]
};
