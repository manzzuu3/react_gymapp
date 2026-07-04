import * as SQLite from 'expo-sqlite';
import exercisesSeed from '../../assets/Exercises.json';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('workoutlog.db');
  }
  return dbInstance;
}

export async function initDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await getDb();

  // Create tables in order
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      muscleGroupRaw TEXT NOT NULL,
      mechanicRaw TEXT NOT NULL,
      isCustom INTEGER DEFAULT 0,
      equipment TEXT,
      force TEXT,
      level TEXT,
      instructionsText TEXT,
      imagesText TEXT,
      secondaryMusclesText TEXT
    );

    CREATE TABLE IF NOT EXISTS training_plans (
      id TEXT PRIMARY KEY,
      scheduleWeekdaysMask INTEGER NOT NULL DEFAULT 0,
      scheduleStart TEXT,
      scheduleDurationRaw TEXT NOT NULL DEFAULT 'weeks',
      scheduleWeeks INTEGER DEFAULT 6,
      scheduleEnd TEXT,
      skipEvents TEXT
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'New Workout',
      typeRaw TEXT NOT NULL DEFAULT 'other',
      notes TEXT NOT NULL DEFAULT '',
      planId TEXT,
      rotationIndex INTEGER DEFAULT 0,
      FOREIGN KEY(planId) REFERENCES training_plans(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS template_exercises (
      id TEXT PRIMARY KEY,
      workoutId TEXT NOT NULL,
      exerciseId TEXT,
      exerciseName TEXT NOT NULL,
      orderIndex INTEGER NOT NULL DEFAULT 0,
      targetSets INTEGER DEFAULT 3,
      targetReps INTEGER DEFAULT 10,
      targetWeightKg REAL DEFAULT 0,
      note TEXT,
      supersetGroup INTEGER,
      FOREIGN KEY(workoutId) REFERENCES workouts(id) ON DELETE CASCADE,
      FOREIGN KEY(exerciseId) REFERENCES exercises(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS workout_days (
      id TEXT PRIMARY KEY,
      date TEXT UNIQUE NOT NULL, -- 'YYYY-MM-DD'
      title TEXT,
      typeRaw TEXT NOT NULL DEFAULT 'other',
      notes TEXT NOT NULL DEFAULT '',
      sourceWorkoutId TEXT,
      startedAt TEXT,
      finishedAt TEXT,
      isOverridden INTEGER DEFAULT 0,
      isSkipped INTEGER DEFAULT 0,
      FOREIGN KEY(sourceWorkoutId) REFERENCES workouts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS exercise_entries (
      id TEXT PRIMARY KEY,
      dayId TEXT NOT NULL,
      exerciseId TEXT,
      exerciseName TEXT NOT NULL,
      muscleGroupRaw TEXT,
      secondaryMuscleGroupsRaw TEXT,
      orderIndex INTEGER NOT NULL DEFAULT 0,
      targetSets INTEGER DEFAULT 3,
      targetReps INTEGER DEFAULT 10,
      targetWeightKg REAL DEFAULT 0,
      note TEXT,
      supersetGroup INTEGER,
      FOREIGN KEY(dayId) REFERENCES workout_days(id) ON DELETE CASCADE,
      FOREIGN KEY(exerciseId) REFERENCES exercises(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS set_entries (
      id TEXT PRIMARY KEY,
      entryId TEXT NOT NULL,
      setNumber INTEGER NOT NULL DEFAULT 1,
      weightKg REAL,
      reps INTEGER,
      isDone INTEGER DEFAULT 0,
      rpe REAL,
      isWarmup INTEGER DEFAULT 0,
      FOREIGN KEY(entryId) REFERENCES exercise_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kcalPer100g REAL NOT NULL DEFAULT 0,
      proteinPer100g REAL NOT NULL DEFAULT 0,
      carbsPer100g REAL NOT NULL DEFAULT 0,
      fatPer100g REAL NOT NULL DEFAULT 0,
      barcode TEXT,
      isCustom INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS food_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL, -- 'YYYY-MM-DD'
      productId TEXT,
      productName TEXT NOT NULL,
      mealName TEXT,
      createdAt TEXT NOT NULL,
      grams REAL NOT NULL DEFAULT 0,
      kcal REAL NOT NULL DEFAULT 0,
      proteinG REAL NOT NULL DEFAULT 0,
      carbsG REAL NOT NULL DEFAULT 0,
      fatG REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(productId) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meal_ingredients (
      id TEXT PRIMARY KEY,
      mealId TEXT NOT NULL,
      productId TEXT,
      productName TEXT NOT NULL,
      grams REAL NOT NULL DEFAULT 0,
      kcal REAL NOT NULL DEFAULT 0,
      proteinG REAL NOT NULL DEFAULT 0,
      carbsG REAL NOT NULL DEFAULT 0,
      fatG REAL NOT NULL DEFAULT 0,
      orderIndex INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(mealId) REFERENCES meals(id) ON DELETE CASCADE,
      FOREIGN KEY(productId) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS bodyweight_entries (
      id TEXT PRIMARY KEY,
      date TEXT UNIQUE NOT NULL, -- 'YYYY-MM-DD'
      weightKg REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS chat_turns (
      id TEXT PRIMARY KEY,
      roleRaw TEXT NOT NULL DEFAULT 'user',
      text TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      orderIndex INTEGER NOT NULL
    );
  `);

  // Check if exercises need seeding
  const rowCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises;');
  if (!rowCount || rowCount.count === 0) {
    console.log('Seeding exercises catalog...');
    // Seed using bulk transaction
    await db.withTransactionAsync(async () => {
      for (const ex of exercisesSeed) {
        const id = ex.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const instructionsText = (ex.instructions || []).join('\n');
        const imagesText = (ex.images || []).join('\n');
        const secondaryMusclesText = (ex.secondaryMuscles || []).join('\n');

        await db.runAsync(
          `INSERT INTO exercises (id, name, muscleGroupRaw, mechanicRaw, isCustom, equipment, force, level, instructionsText, imagesText, secondaryMusclesText) 
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            ex.name,
            ex.muscleGroup,
            ex.mechanic.toLowerCase(),
            ex.equipment || null,
            ex.force || null,
            ex.level || null,
            instructionsText,
            imagesText,
            secondaryMusclesText
          ]
        );
      }
    });
    console.log('Seeding completed.');
  }

  return db;
}
