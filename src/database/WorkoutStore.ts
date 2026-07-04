import { getDb } from './db';
import { 
  Exercise, Workout, TemplateExercise, TrainingPlan, 
  WorkoutDay, ExerciseEntry, SetEntry 
} from './types';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export class WorkoutStore {
  // MARK: - Exercises
  
  static async fetchExercises(): Promise<Exercise[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM exercises ORDER BY name;');
    return rows.map(r => ({
      ...r,
      isCustom: r.isCustom === 1
    }));
  }

  static async fetchExerciseById(id: string): Promise<Exercise | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM exercises WHERE id = ?;', [id]);
    if (!row) return null;
    return {
      ...row,
      isCustom: row.isCustom === 1
    };
  }

  static async createCustomExercise(
    name: string, 
    muscleGroup: string, 
    mechanic: string, 
    equipment?: string, 
    secondaryMuscles: string[] = []
  ): Promise<Exercise> {
    const db = await getDb();
    const id = 'custom_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const ex: Exercise = {
      id,
      name,
      muscleGroupRaw: muscleGroup,
      mechanicRaw: mechanic,
      isCustom: true,
      equipment,
      instructionsText: '',
      imagesText: '',
      secondaryMusclesText: secondaryMuscles.join('\n')
    };

    await db.runAsync(
      `INSERT INTO exercises (id, name, muscleGroupRaw, mechanicRaw, isCustom, equipment, secondaryMusclesText, instructionsText, imagesText)
       VALUES (?, ?, ?, ?, 1, ?, ?, '', '')`,
      [id, name, muscleGroup, mechanic, equipment || null, secondaryMuscles.join('\n')]
    );

    return ex;
  }

  static async deleteCustomExercise(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM exercises WHERE id = ? AND isCustom = 1;', [id]);
  }

  // MARK: - Workouts
  
  static async fetchWorkouts(): Promise<Workout[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM workouts ORDER BY rotationIndex, name;');
    const workouts: Workout[] = [];
    
    for (const r of rows) {
      const exercises = await this.fetchTemplateExercises(r.id);
      workouts.push({
        id: r.id,
        name: r.name,
        typeRaw: r.typeRaw,
        notes: r.notes,
        planId: r.planId || undefined,
        rotationIndex: r.rotationIndex,
        exercises
      });
    }
    return workouts;
  }

  static async fetchWorkoutDetail(id: string): Promise<Workout | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM workouts WHERE id = ?;', [id]);
    if (!row) return null;
    const exercises = await this.fetchTemplateExercises(id);
    return {
      id: row.id,
      name: row.name,
      typeRaw: row.typeRaw,
      notes: row.notes,
      planId: row.planId || undefined,
      rotationIndex: row.rotationIndex,
      exercises
    };
  }

  static async fetchTemplateExercises(workoutId: string): Promise<TemplateExercise[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM template_exercises WHERE workoutId = ? ORDER BY orderIndex;',
      [workoutId]
    );
    return rows.map(r => ({
      id: r.id,
      workoutId: r.workoutId,
      exerciseId: r.exerciseId || undefined,
      exerciseName: r.exerciseName,
      orderIndex: r.orderIndex,
      targetSets: r.targetSets,
      targetReps: r.targetReps,
      targetWeightKg: r.targetWeightKg,
      note: r.note || undefined,
      supersetGroup: r.supersetGroup || undefined
    }));
  }

  static async createWorkout(name: string, typeRaw: string = 'other', notes: string = ''): Promise<Workout> {
    const db = await getDb();
    const id = generateId();
    await db.runAsync(
      'INSERT INTO workouts (id, name, typeRaw, notes, rotationIndex) VALUES (?, ?, ?, ?, 0);',
      [id, name, typeRaw, notes]
    );
    return { id, name, typeRaw, notes, rotationIndex: 0, exercises: [] };
  }

  static async saveWorkoutTemplates(workoutId: string, exercises: Omit<TemplateExercise, 'id' | 'workoutId'>[]): Promise<void> {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      // Clear old template exercises
      await db.runAsync('DELETE FROM template_exercises WHERE workoutId = ?;', [workoutId]);
      
      // Write new template exercises
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        const teId = generateId();
        await db.runAsync(
          `INSERT INTO template_exercises (id, workoutId, exerciseId, exerciseName, orderIndex, targetSets, targetReps, targetWeightKg, note, supersetGroup)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            teId, 
            workoutId, 
            ex.exerciseId || null, 
            ex.exerciseName, 
            ex.orderIndex, 
            ex.targetSets, 
            ex.targetReps, 
            ex.targetWeightKg, 
            ex.note || null, 
            ex.supersetGroup || null
          ]
        );
      }
    });
  }

  static async deleteWorkout(workoutId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM workouts WHERE id = ?;', [workoutId]);
  }

  // MARK: - Training Plans
  
  static async fetchTrainingPlan(id: string): Promise<TrainingPlan | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM training_plans WHERE id = ?;', [id]);
    if (!row) return null;
    return {
      id: row.id,
      scheduleWeekdaysMask: row.scheduleWeekdaysMask,
      scheduleStart: row.scheduleStart || undefined,
      scheduleDurationRaw: row.scheduleDurationRaw,
      scheduleWeeks: row.scheduleWeeks,
      scheduleEnd: row.scheduleEnd || undefined,
      skipEvents: row.skipEvents ? JSON.parse(row.skipEvents) : []
    };
  }

  static async createTrainingPlan(plan: Omit<TrainingPlan, 'id'>): Promise<TrainingPlan> {
    const db = await getDb();
    const id = generateId();
    const skipEventsStr = JSON.stringify(plan.skipEvents);
    await db.runAsync(
      `INSERT INTO training_plans (id, scheduleWeekdaysMask, scheduleStart, scheduleDurationRaw, scheduleWeeks, scheduleEnd, skipEvents)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        plan.scheduleWeekdaysMask, 
        plan.scheduleStart || null, 
        plan.scheduleDurationRaw, 
        plan.scheduleWeeks, 
        plan.scheduleEnd || null, 
        skipEventsStr
      ]
    );
    return { ...plan, id };
  }

  static async updateTrainingPlan(plan: TrainingPlan): Promise<void> {
    const db = await getDb();
    const skipEventsStr = JSON.stringify(plan.skipEvents);
    await db.runAsync(
      `UPDATE training_plans 
       SET scheduleWeekdaysMask = ?, scheduleStart = ?, scheduleDurationRaw = ?, scheduleWeeks = ?, scheduleEnd = ?, skipEvents = ?
       WHERE id = ?`,
      [
        plan.scheduleWeekdaysMask, 
        plan.scheduleStart || null, 
        plan.scheduleDurationRaw, 
        plan.scheduleWeeks, 
        plan.scheduleEnd || null, 
        skipEventsStr,
        plan.id
      ]
    );
  }

  static async linkWorkoutToPlan(workoutId: string, planId: string | null, rotationIndex: number): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'UPDATE workouts SET planId = ?, rotationIndex = ? WHERE id = ?;',
      [planId, rotationIndex, workoutId]
    );
  }

  // MARK: - Workout Days
  
  static async fetchWorkoutDay(date: string): Promise<WorkoutDay | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM workout_days WHERE date = ?;', [date]);
    if (!row) return null;
    return {
      id: row.id,
      date: row.date,
      title: row.title || undefined,
      typeRaw: row.typeRaw,
      notes: row.notes,
      sourceWorkoutId: row.sourceWorkoutId || undefined,
      startedAt: row.startedAt || undefined,
      finishedAt: row.finishedAt || undefined,
      isOverridden: row.isOverridden === 1,
      isSkipped: row.isSkipped === 1
    };
  }

  static async fetchWorkoutDayWithEntries(date: string): Promise<WorkoutDay | null> {
    const day = await this.fetchWorkoutDay(date);
    if (!day) return null;

    const db = await getDb();
    const entries = await db.getAllAsync<any>(
      'SELECT * FROM exercise_entries WHERE dayId = ? ORDER BY orderIndex;',
      [day.id]
    );

    const fullEntries: ExerciseEntry[] = [];
    for (const ent of entries) {
      const sets = await db.getAllAsync<any>(
        'SELECT * FROM set_entries WHERE entryId = ? ORDER BY setNumber;',
        [ent.id]
      );
      fullEntries.push({
        id: ent.id,
        dayId: ent.dayId,
        exerciseId: ent.exerciseId || undefined,
        exerciseName: ent.exerciseName,
        muscleGroupRaw: ent.muscleGroupRaw || undefined,
        secondaryMuscleGroupsRaw: ent.secondaryMuscleGroupsRaw || undefined,
        orderIndex: ent.orderIndex,
        targetSets: ent.targetSets,
        targetReps: ent.targetReps,
        targetWeightKg: ent.targetWeightKg,
        note: ent.note || undefined,
        supersetGroup: ent.supersetGroup || undefined,
        sets: sets.map(s => ({
          id: s.id,
          entryId: s.entryId,
          setNumber: s.setNumber,
          weightKg: s.weightKg ?? undefined,
          reps: s.reps ?? undefined,
          isDone: s.isDone === 1,
          rpe: s.rpe ?? undefined,
          isWarmup: s.isWarmup === 1
        }))
      });
    }

    day.entries = fullEntries;
    return day;
  }

  static async createWorkoutDay(
    date: string, 
    title?: string, 
    typeRaw: string = 'other', 
    sourceWorkoutId?: string
  ): Promise<WorkoutDay> {
    const db = await getDb();
    const id = generateId();
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_days (id, date, title, typeRaw, notes, sourceWorkoutId, isOverridden, isSkipped)
       VALUES (?, ?, ?, ?, '', ?, 0, 0)`,
      [id, date, title || null, typeRaw, sourceWorkoutId || null]
    );
    return {
      id,
      date,
      title,
      typeRaw,
      notes: '',
      sourceWorkoutId,
      isOverridden: false,
      isSkipped: false,
      entries: []
    };
  }

  static async updateWorkoutDay(day: WorkoutDay): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE workout_days 
       SET title = ?, typeRaw = ?, notes = ?, startedAt = ?, finishedAt = ?, isOverridden = ?, isSkipped = ?
       WHERE id = ?`,
      [
        day.title || null, 
        day.typeRaw, 
        day.notes, 
        day.startedAt || null, 
        day.finishedAt || null, 
        day.isOverridden ? 1 : 0, 
        day.isSkipped ? 1 : 0,
        day.id
      ]
    );
  }

  static async deleteWorkoutDay(dayId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM workout_days WHERE id = ?;', [dayId]);
  }

  static async fetchWorkoutDaysRange(startDate: string, endDate: string): Promise<WorkoutDay[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM workout_days WHERE date >= ? AND date <= ? ORDER BY date;',
      [startDate, endDate]
    );
    return rows.map(r => ({
      id: r.id,
      date: r.date,
      title: r.title || undefined,
      typeRaw: r.typeRaw,
      notes: r.notes,
      sourceWorkoutId: r.sourceWorkoutId || undefined,
      startedAt: r.startedAt || undefined,
      finishedAt: r.finishedAt || undefined,
      isOverridden: r.isOverridden === 1,
      isSkipped: r.isSkipped === 1
    }));
  }

  // MARK: - Exercise Entries & Sets
  
  static async addExerciseToDay(
    dayId: string, 
    exerciseId: string | undefined, 
    exerciseName: string, 
    muscleGroupRaw: string | undefined,
    secondaryMuscleGroupsRaw: string | undefined,
    orderIndex: number,
    targetSets: number = 3,
    targetReps: number = 10,
    targetWeightKg: number = 0,
    supersetGroup?: number
  ): Promise<ExerciseEntry> {
    const db = await getDb();
    const entryId = generateId();

    await db.runAsync(
      `INSERT INTO exercise_entries (id, dayId, exerciseId, exerciseName, muscleGroupRaw, secondaryMuscleGroupsRaw, orderIndex, targetSets, targetReps, targetWeightKg, supersetGroup)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entryId, 
        dayId, 
        exerciseId || null, 
        exerciseName, 
        muscleGroupRaw || null, 
        secondaryMuscleGroupsRaw || null, 
        orderIndex, 
        targetSets, 
        targetReps, 
        targetWeightKg, 
        supersetGroup || null
      ]
    );

    // Seed sets
    const sets: SetEntry[] = [];
    for (let i = 1; i <= Math.max(1, targetSets); i++) {
      const setId = generateId();
      await db.runAsync(
        'INSERT INTO set_entries (id, entryId, setNumber, isDone, isWarmup) VALUES (?, ?, ?, 0, 0);',
        [setId, entryId, i]
      );
      sets.push({
        id: setId,
        entryId,
        setNumber: i,
        isDone: false,
        isWarmup: false
      });
    }

    return {
      id: entryId,
      dayId,
      exerciseId,
      exerciseName,
      muscleGroupRaw,
      secondaryMuscleGroupsRaw,
      orderIndex,
      targetSets,
      targetReps,
      targetWeightKg,
      sets
    };
  }

  static async updateExerciseEntry(entry: ExerciseEntry): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE exercise_entries 
       SET exerciseName = ?, targetSets = ?, targetReps = ?, targetWeightKg = ?, note = ?, supersetGroup = ?
       WHERE id = ?`,
      [
        entry.exerciseName, 
        entry.targetSets, 
        entry.targetReps, 
        entry.targetWeightKg, 
        entry.note || null, 
        entry.supersetGroup || null,
        entry.id
      ]
    );
  }

  static async deleteExerciseEntry(entryId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM exercise_entries WHERE id = ?;', [entryId]);
  }

  static async addSetToEntry(entryId: string, setNumber: number): Promise<SetEntry> {
    const db = await getDb();
    const id = generateId();
    await db.runAsync(
      'INSERT INTO set_entries (id, entryId, setNumber, isDone, isWarmup) VALUES (?, ?, ?, 0, 0);',
      [id, entryId, setNumber]
    );
    return {
      id,
      entryId,
      setNumber,
      isDone: false,
      isWarmup: false
    };
  }

  static async updateSetEntry(set: SetEntry): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'UPDATE set_entries SET weightKg = ?, reps = ?, isDone = ?, rpe = ?, isWarmup = ? WHERE id = ?;',
      [
        set.weightKg !== undefined ? set.weightKg : null,
        set.reps !== undefined ? set.reps : null,
        set.isDone ? 1 : 0,
        set.rpe !== undefined ? set.rpe : null,
        set.isWarmup ? 1 : 0,
        set.id
      ]
    );
  }

  static async deleteSetEntry(setId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM set_entries WHERE id = ?;', [setId]);
  }

  // MARK: - Safe child-context-like edit pattern
  // Save an entire day's edits atomically in a single transaction
  static async saveDayEdits(
    dayId: string, 
    dayUpdates: { title?: string; typeRaw: string; notes: string; isOverridden: boolean },
    entries: {
      id?: string; // If missing, this is a new entry
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
      sets: {
        id?: string;
        setNumber: number;
        weightKg?: number;
        reps?: number;
        isDone: boolean;
        rpe?: number;
        isWarmup: boolean;
      }[];
    }[]
  ): Promise<void> {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      // 1. Update day properties
      await db.runAsync(
        'UPDATE workout_days SET title = ?, typeRaw = ?, notes = ?, isOverridden = ? WHERE id = ?',
        [dayUpdates.title || null, dayUpdates.typeRaw, dayUpdates.notes, dayUpdates.isOverridden ? 1 : 0, dayId]
      );

      // 2. Fetch existing entries to detect deletions
      const existingEntries = await db.getAllAsync<{ id: string }>('SELECT id FROM exercise_entries WHERE dayId = ?', [dayId]);
      const activeEntryIds = entries.filter(e => e.id).map(e => e.id!);
      const deletedEntryIds = existingEntries.filter(e => !activeEntryIds.includes(e.id)).map(e => e.id);
      
      for (const delId of deletedEntryIds) {
        await db.runAsync('DELETE FROM exercise_entries WHERE id = ?', [delId]);
      }

      // 3. Insert or update remaining entries
      for (const ent of entries) {
        let entryId = ent.id;
        if (!entryId) {
          entryId = generateId();
          await db.runAsync(
            `INSERT INTO exercise_entries (id, dayId, exerciseId, exerciseName, muscleGroupRaw, secondaryMuscleGroupsRaw, orderIndex, targetSets, targetReps, targetWeightKg, note, supersetGroup)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              entryId, dayId, ent.exerciseId || null, ent.exerciseName, 
              ent.muscleGroupRaw || null, ent.secondaryMuscleGroupsRaw || null, 
              ent.orderIndex, ent.targetSets, ent.targetReps, ent.targetWeightKg, 
              ent.note || null, ent.supersetGroup || null
            ]
          );
        } else {
          await db.runAsync(
            `UPDATE exercise_entries 
             SET exerciseName = ?, orderIndex = ?, targetSets = ?, targetReps = ?, targetWeightKg = ?, note = ?, supersetGroup = ?
             WHERE id = ?`,
            [ent.exerciseName, ent.orderIndex, ent.targetSets, ent.targetReps, ent.targetWeightKg, ent.note || null, ent.supersetGroup || null, entryId]
          );
        }

        // Handle sets inside this entry
        const existingSets = await db.getAllAsync<{ id: string }>('SELECT id FROM set_entries WHERE entryId = ?', [entryId]);
        const activeSetIds = ent.sets.filter(s => s.id).map(s => s.id!);
        const deletedSetIds = existingSets.filter(s => !activeSetIds.includes(s.id)).map(s => s.id);

        for (const delSetId of deletedSetIds) {
          await db.runAsync('DELETE FROM set_entries WHERE id = ?', [delSetId]);
        }

        for (const set of ent.sets) {
          if (!set.id) {
            const setId = generateId();
            await db.runAsync(
              'INSERT INTO set_entries (id, entryId, setNumber, weightKg, reps, isDone, rpe, isWarmup) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [
                setId, entryId, set.setNumber, 
                set.weightKg !== undefined ? set.weightKg : null,
                set.reps !== undefined ? set.reps : null,
                set.isDone ? 1 : 0,
                set.rpe !== undefined ? set.rpe : null,
                set.isWarmup ? 1 : 0
              ]
            );
          } else {
            await db.runAsync(
              'UPDATE set_entries SET setNumber = ?, weightKg = ?, reps = ?, isDone = ?, rpe = ?, isWarmup = ? WHERE id = ?',
              [
                set.setNumber,
                set.weightKg !== undefined ? set.weightKg : null,
                set.reps !== undefined ? set.reps : null,
                set.isDone ? 1 : 0,
                set.rpe !== undefined ? set.rpe : null,
                set.isWarmup ? 1 : 0,
                set.id
              ]
            );
          }
        }
      }
    });
  }

  static async updateWorkout(workout: Workout): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'UPDATE workouts SET name = ?, typeRaw = ?, notes = ? WHERE id = ?;',
      [workout.name, workout.typeRaw, workout.notes, workout.id]
    );
  }

  static async deleteTrainingPlan(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM training_plans WHERE id = ?;', [id]);
  }
}
