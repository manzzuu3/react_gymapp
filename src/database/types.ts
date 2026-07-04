export interface Exercise {
  id: string;
  name: string;
  muscleGroupRaw: string;
  mechanicRaw: string;
  isCustom: boolean;
  equipment?: string;
  force?: string;
  level?: string;
  instructionsText: string;
  imagesText: string;
  secondaryMusclesText: string;
}

export interface SkipEvent {
  date: string; // 'YYYY-MM-DD'
  slides: boolean;
}

export interface TrainingPlan {
  id: string;
  scheduleWeekdaysMask: number;
  scheduleStart?: string; // ISO
  scheduleDurationRaw: 'weeks' | 'untilDate' | 'ongoing';
  scheduleWeeks: number;
  scheduleEnd?: string; // ISO
  skipEvents: SkipEvent[];
  rotation?: Workout[];
}

export interface Workout {
  id: string;
  name: string;
  typeRaw: string;
  notes: string;
  planId?: string;
  rotationIndex: number;
  exercises?: TemplateExercise[];
}

export interface TemplateExercise {
  id: string;
  workoutId: string;
  exerciseId?: string;
  exerciseName: string;
  orderIndex: number;
  targetSets: number;
  targetReps: number;
  targetWeightKg: number;
  note?: string;
  supersetGroup?: number;
}

export interface WorkoutDay {
  id: string;
  date: string; // 'YYYY-MM-DD'
  title?: string;
  typeRaw: string;
  notes: string;
  sourceWorkoutId?: string;
  startedAt?: string; // ISO
  finishedAt?: string; // ISO
  isOverridden: boolean;
  isSkipped: boolean;
  entries?: ExerciseEntry[];
}

export interface ExerciseEntry {
  id: string;
  dayId: string;
  exerciseId?: string;
  exerciseName: string;
  muscleGroupRaw?: string;
  secondaryMuscleGroupsRaw?: string;
  orderIndex: number;
  targetSets: number;
  targetReps: number;
  targetWeightKg: number;
  note?: string;
  supersetGroup?: number;
  sets?: SetEntry[];
}

export interface SetEntry {
  id: string;
  entryId: string;
  setNumber: number;
  weightKg?: number; // null if not logged
  reps?: number;     // null if not logged
  isDone: boolean;
  rpe?: number;      // null if not logged
  isWarmup: boolean;
}

export interface Product {
  id: string; // name or barcode
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  barcode?: string;
  isCustom: boolean;
}

export interface FoodEntry {
  id: string;
  date: string; // 'YYYY-MM-DD'
  productId?: string;
  productName: string;
  mealName?: string;
  createdAt: string; // ISO string
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Meal {
  id: string;
  name: string;
  createdAt: string; // ISO string
  ingredients?: MealIngredient[];
}

export interface MealIngredient {
  id: string;
  mealId: string;
  productId?: string;
  productName: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  orderIndex: number;
}

export interface BodyweightEntry {
  id: string;
  date: string; // 'YYYY-MM-DD'
  weightKg: number;
}

export interface ChatTurn {
  id: string;
  roleRaw: 'user' | 'assistant';
  text: string;
  createdAt: string; // ISO string
  orderIndex: number;
}
