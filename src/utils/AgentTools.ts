import { WorkoutStore } from '../database/WorkoutStore';
import { NutritionStore } from '../database/NutritionStore';
import { BodyweightStore } from '../database/BodyweightStore';
import { searchGenericFoods } from '../database/FoodDatabase';
import { WorkoutScheduler } from './WorkoutScheduler';
import { DateHelpers } from './DateHelpers';
import { FoodEntry, ExerciseEntry, Workout, Meal, Product, Exercise, WorkoutDay } from '../database/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory undo stack for the current assistant session
interface UndoAction {
  type: 'log_food' | 'add_exercise' | 'schedule_workout' | 'skip_workout' | 'log_meal' | 'set_targets';
  data: any;
}

class UndoStack {
  private stack: UndoAction[] = [];

  push(action: UndoAction) {
    this.stack.push(action);
  }

  pop(): UndoAction | undefined {
    return this.stack.pop();
  }

  clear() {
    this.stack = [];
  }
}

const undoStack = new UndoStack();

export interface ToolArgument {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
  required?: boolean;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  handler: (args: any) => Promise<string>;
}

export const AgentTools: AgentTool[] = [
  // 1. search_food
  {
    name: 'search_food',
    description: 'Search the food catalogue for foods matching a query. Returns per-100g calories and protein for each match. Call this to find the right food before answering nutrition questions.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Food name, e.g. "chicken breast"' }
      },
      required: ['query']
    },
    handler: async (args) => {
      const query = (args.query || '').trim();
      if (!query) return 'Provide a food name to search.';

      // Branded/custom cache first
      const products = await NutritionStore.fetchProducts();
      const cached = products.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 4);

      // Generic catalog
      const generic = await searchGenericFoods(query, 8);
      
      const results = [
        ...cached.map(p => ({ name: p.name, kcal: p.kcalPer100g, protein: p.proteinPer100g, source: 'Custom' })),
        ...generic.map(f => ({ name: f.name, kcal: f.kcal, protein: f.protein, source: 'Generic' }))
      ].slice(0, 8);

      if (results.length === 0) return `No foods found for "${query}".`;

      const lines = results.map(r => 
        `- ${r.name}: ${Math.round(r.kcal)} kcal, ${r.protein.toFixed(1)}g protein per 100g (${r.source})`
      );

      return `Foods matching "${query}":\n` + lines.join('\n');
    }
  },

  // 2. search_exercise
  {
    name: 'search_exercise',
    description: 'Search the exercise catalogue by name. Returns matching exercises with their primary muscle group.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Exercise name, e.g. "bench press"' }
      },
      required: ['query']
    },
    handler: async (args) => {
      const query = (args.query || '').trim();
      if (!query) return 'Provide an exercise name to search.';

      const exercises = await WorkoutStore.fetchExercises();
      const results = exercises
        .filter(ex => ex.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8);

      if (results.length === 0) return `No exercises found for "${query}".`;

      const lines = results.map(ex => `- ${ex.name} (${ex.muscleGroupRaw.toUpperCase()})`);
      return `Exercises matching "${query}":\n` + lines.join('\n');
    }
  },

  // 3. get_day_summary
  {
    name: 'get_day_summary',
    description: 'Summarise a day: calories and protein consumed vs the user\'s daily targets, plus workout set progress. Omit the date for today.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'ISO date string "YYYY-MM-DD", defaults to today' }
      },
      required: []
    },
    handler: async (args) => {
      const todayStr = DateHelpers.toISODateString(new Date());
      const dateStr = args.date || todayStr;

      // Targets
      const kcalTarget = parseInt((await AsyncStorage.getItem('dailyKcalTarget')) || '2000', 10);
      const proteinTarget = parseInt((await AsyncStorage.getItem('dailyProteinTarget')) || '130', 10);

      // Nutrition
      const foods = await NutritionStore.fetchFoodEntries(dateStr);
      const totals = foods.reduce(
        (acc, f) => {
          acc.kcal += f.kcal;
          acc.protein += f.proteinG;
          return acc;
        },
        { kcal: 0, protein: 0 }
      );

      // Workout
      const day = await WorkoutStore.fetchWorkoutDayWithEntries(dateStr);
      let workoutLine = 'No workout scheduled.';
      if (day) {
        if (day.isSkipped) {
          workoutLine = `Workout skipped: ${day.title || 'Rest Day'}.`;
        } else if (day.entries && day.entries.length > 0) {
          const sets = day.entries.flatMap(e => e.sets || []);
          const done = sets.filter(s => s.isDone).length;
          workoutLine = `Workout: ${day.title || 'Active Workout'} (${done}/${sets.length} sets completed).`;
        } else {
          workoutLine = `Rest Day (${day.title || 'Rest'}).`;
        }
      }

      const foodSummary = foods.length > 0 
        ? foods.map(f => `- ${f.productName}: ${Math.round(f.grams)}g (${Math.round(f.kcal)} kcal, ${f.proteinG.toFixed(1)}g protein)`).join('\n')
        : 'No food logged.';

      return `Summary for ${dateStr === todayStr ? 'Today' : dateStr}:
Nutrition: ${Math.round(totals.kcal)} / ${kcalTarget} kcal, ${totals.protein.toFixed(1)} / ${proteinTarget}g protein.
${workoutLine}

Logged Foods:
${foodSummary}`;
    }
  },

  // 4. log_food
  {
    name: 'log_food',
    description: 'Log a food serving on a day. Finds the best match in the database first.',
    parameters: {
      type: 'object',
      properties: {
        food_name: { type: 'string', description: 'Food name to log' },
        grams: { type: 'number', description: 'Grams consumed' },
        date: { type: 'string', description: 'ISO date "YYYY-MM-DD", defaults to today' }
      },
      required: ['food_name', 'grams']
    },
    handler: async (args) => {
      const foodName = (args.food_name || '').trim();
      const grams = parseFloat(args.grams);
      const date = args.date || DateHelpers.toISODateString(new Date());

      if (!foodName || isNaN(grams) || grams <= 0) return 'Invalid food name or grams.';

      // Search matching food
      const products = await NutritionStore.fetchProducts();
      const cached = products.find(p => p.name.toLowerCase() === foodName.toLowerCase());

      let item;
      if (cached) {
        item = { id: cached.id, name: cached.name, kcalPer100g: cached.kcalPer100g, proteinPer100g: cached.proteinPer100g, carbsPer100g: cached.carbsPer100g, fatPer100g: cached.fatPer100g };
      } else {
        const generic = await searchGenericFoods(foodName, 1);
        if (generic.length > 0) {
          const g = generic[0];
          item = { name: g.name, kcalPer100g: g.kcal, proteinPer100g: g.protein, carbsPer100g: g.carbs, fatPer100g: g.fat };
        }
      }

      if (!item) {
        return `Could not find "${foodName}" in database. Try creating it first or search for a generic synonym.`;
      }

      const entry = await NutritionStore.logFood(item, grams, date);
      
      // Save for undo
      undoStack.push({
        type: 'log_food',
        data: { entryId: entry.id }
      });

      return `Successfully logged ${Math.round(grams)}g of "${entry.productName}" (${Math.round(entry.kcal)} kcal, ${entry.proteinG.toFixed(1)}g protein) on ${date}.`;
    }
  },

  // 5. add_exercise
  {
    name: 'add_exercise',
    description: 'Add an exercise to a workout day with target sets, reps, and weight.',
    parameters: {
      type: 'object',
      properties: {
        exercise_name: { type: 'string', description: 'Exercise name' },
        target_sets: { type: 'number', description: 'Sets target (default 3)' },
        target_reps: { type: 'number', description: 'Reps target (default 10)' },
        target_weight: { type: 'number', description: 'Weight in kg target (default 0)' },
        date: { type: 'string', description: 'ISO date "YYYY-MM-DD", defaults to today' }
      },
      required: ['exercise_name']
    },
    handler: async (args) => {
      const exerciseName = (args.exercise_name || '').trim();
      const sets = parseInt(args.target_sets || '3', 10);
      const reps = parseInt(args.target_reps || '10', 10);
      const weight = parseFloat(args.target_weight || '0');
      const date = args.date || DateHelpers.toISODateString(new Date());

      if (!exerciseName) return 'Invalid exercise name.';

      // Get or create workout day
      let day = await WorkoutStore.fetchWorkoutDayWithEntries(date);
      if (!day) {
        day = await WorkoutStore.createWorkoutDay(date);
      }

      // Search catalog exercise
      const exercises = await WorkoutStore.fetchExercises();
      const match = exercises.find(ex => ex.name.toLowerCase() === exerciseName.toLowerCase()) ||
                    exercises.find(ex => ex.name.toLowerCase().includes(exerciseName.toLowerCase()));

      let exId = match?.id;
      let exName = match?.name || exerciseName;
      let muscle = match?.muscleGroupRaw || 'other';
      let secondary = match?.secondaryMusclesText || '';

      if (!match) {
        // Create custom exercise
        const created = await WorkoutStore.createCustomExercise(exerciseName, 'other', 'compound');
        exId = created.id;
        exName = created.name;
      }

      // Calculate order index
      const orderIndex = day.entries?.length || 0;

      const entry = await WorkoutStore.addExerciseToDay(
        day.id,
        exId,
        exName,
        muscle,
        secondary,
        orderIndex,
        sets,
        reps,
        weight
      );

      // Save for undo
      undoStack.push({
        type: 'add_exercise',
        data: { entryId: entry.id }
      });

      return `Successfully added "${exName}" (${sets} sets x ${reps} reps @ ${weight} kg) to ${date}.`;
    }
  },

  // 6. schedule_workout
  {
    name: 'schedule_workout',
    description: 'Schedule a template workout onto a specific calendar day.',
    parameters: {
      type: 'object',
      properties: {
        workout_name: { type: 'string', description: 'Name of the template workout' },
        date: { type: 'string', description: 'ISO date "YYYY-MM-DD", defaults to today' }
      },
      required: ['workout_name']
    },
    handler: async (args) => {
      const workoutName = (args.workout_name || '').trim();
      const date = args.date || DateHelpers.toISODateString(new Date());

      if (!workoutName) return 'Invalid workout name.';

      const workouts = await WorkoutStore.fetchWorkouts();
      const workout = workouts.find(w => w.name.toLowerCase() === workoutName.toLowerCase()) ||
                      workouts.find(w => w.name.toLowerCase().includes(workoutName.toLowerCase()));

      if (!workout) return `Could not find a workout template named "${workoutName}".`;

      let day = await WorkoutStore.fetchWorkoutDayWithEntries(date);
      if (!day) {
        day = await WorkoutStore.createWorkoutDay(date);
      }

      // Backup day entries for undo
      const backupEntries = day.entries ? JSON.parse(JSON.stringify(day.entries)) : [];
      const backupTitle = day.title;
      const backupType = day.typeRaw;
      const backupWorkoutId = day.sourceWorkoutId;

      await WorkoutScheduler.stamp(day, workout);

      undoStack.push({
        type: 'schedule_workout',
        data: {
          dayId: day.id,
          date,
          backupTitle,
          backupType,
          backupWorkoutId,
          backupEntries
        }
      });

      return `Successfully scheduled workout template "${workout.name}" onto ${date}.`;
    }
  },

  // 7. skip_workout
  {
    name: 'skip_workout',
    description: 'Mark a scheduled workout day as skipped (slides the training series forward or holds it in place).',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'ISO date "YYYY-MM-DD", defaults to today' },
        slides: { type: 'boolean', description: 'If true, slides remaining workouts; if false, consumes this session slot.' }
      },
      required: ['slides']
    },
    handler: async (args) => {
      const date = args.date || DateHelpers.toISODateString(new Date());
      const slides = args.slides === true || args.slides === 'true';

      const day = await WorkoutStore.fetchWorkoutDayWithEntries(date);
      if (!day || !day.sourceWorkoutId) {
        return `No scheduled workout exists on ${date} to skip. Only scheduled sessions can be skipped.`;
      }

      const doneSets = day.entries?.flatMap(e => e.sets || []).filter(s => s.isDone).length || 0;
      if (doneSets > 0) {
        return `Cannot skip ${date} because sets have already been logged for this session.`;
      }

      await WorkoutScheduler.skip(day, slides);

      undoStack.push({
        type: 'skip_workout',
        data: { date }
      });

      return `Successfully skipped scheduled workout on ${date} (Slides: ${slides}).`;
    }
  },

  // 8. set_targets
  {
    name: 'set_targets',
    description: 'Set daily calorie and protein nutrition targets.',
    parameters: {
      type: 'object',
      properties: {
        kcal: { type: 'number', description: 'Daily energy target in kcal' },
        protein: { type: 'number', description: 'Daily protein target in grams' }
      },
      required: []
    },
    handler: async (args) => {
      const kcal = args.kcal ? parseInt(args.kcal, 10) : undefined;
      const protein = args.protein ? parseInt(args.protein, 10) : undefined;

      if (kcal === undefined && protein === undefined) return 'Provide kcal or protein target to set.';

      const prevKcal = await AsyncStorage.getItem('dailyKcalTarget');
      const prevProtein = await AsyncStorage.getItem('dailyProteinTarget');

      let msgParts = [];
      if (kcal !== undefined) {
        await AsyncStorage.setItem('dailyKcalTarget', String(kcal));
        msgParts.push(`kcal target to ${kcal}`);
      }
      if (protein !== undefined) {
        await AsyncStorage.setItem('dailyProteinTarget', String(protein));
        msgParts.push(`protein target to ${protein}g`);
      }

      undoStack.push({
        type: 'set_targets',
        data: {
          kcal: prevKcal ? parseInt(prevKcal, 10) : 2000,
          protein: prevProtein ? parseInt(prevProtein, 10) : 130
        }
      });

      return 'Successfully updated ' + msgParts.join(' and ') + '.';
    }
  },

  // 9. undo_last_change
  {
    name: 'undo_last_change',
    description: 'Undo the last write change performed in this assistant session.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    handler: async () => {
      const action = undoStack.pop();
      if (!action) return 'Nothing to undo.';

      try {
        switch (action.type) {
          case 'log_food':
            await NutritionStore.deleteEntry(action.data.entryId);
            return 'Successfully undid last food log.';
            
          case 'add_exercise':
            await WorkoutStore.deleteExerciseEntry(action.data.entryId);
            return 'Successfully undid adding exercise.';
            
          case 'skip_workout':
            const skipDay = await WorkoutStore.fetchWorkoutDay(action.data.date);
            if (skipDay) {
              await WorkoutScheduler.unskip(skipDay);
            }
            return 'Successfully reverted skipped workout.';
            
          case 'set_targets':
            await AsyncStorage.setItem('dailyKcalTarget', String(action.data.kcal));
            await AsyncStorage.setItem('dailyProteinTarget', String(action.data.protein));
            return `Successfully undid targets edit. Reverted targets to ${action.data.kcal} kcal and ${action.data.protein}g protein.`;

          case 'schedule_workout':
            // Restore backed up day state
            const dayId = action.data.dayId;
            const fullDay = await WorkoutStore.fetchWorkoutDayWithEntries(action.data.date);
            if (fullDay && fullDay.entries) {
              for (const ent of fullDay.entries) {
                await WorkoutStore.deleteExerciseEntry(ent.id);
              }
            }

            // Restore day metadata
            const restoredDay: WorkoutDay = {
              id: dayId,
              date: action.data.date,
              title: action.data.backupTitle,
              typeRaw: action.data.backupType,
              notes: '',
              sourceWorkoutId: action.data.backupWorkoutId,
              isOverridden: false,
              isSkipped: false
            };
            await WorkoutStore.updateWorkoutDay(restoredDay);

            // Restore entries
            for (const backupEnt of action.data.backupEntries) {
              const entry = await WorkoutStore.addExerciseToDay(
                dayId,
                backupEnt.exerciseId,
                backupEnt.exerciseName,
                backupEnt.muscleGroupRaw,
                backupEnt.secondaryMuscleGroupsRaw,
                backupEnt.orderIndex,
                backupEnt.targetSets,
                backupEnt.targetReps,
                backupEnt.targetWeightKg,
                backupEnt.supersetGroup
              );
              entry.note = backupEnt.note;
              await WorkoutStore.updateExerciseEntry(entry);

              // Restore set logs
              const entrySets = entry.sets || [];
              for (let i = 0; i < backupEnt.sets.length; i++) {
                const bSet = backupEnt.sets[i];
                if (i < entrySets.length) {
                  entrySets[i].weightKg = bSet.weightKg;
                  entrySets[i].reps = bSet.reps;
                  entrySets[i].isDone = bSet.isDone;
                  entrySets[i].rpe = bSet.rpe;
                  entrySets[i].isWarmup = bSet.isWarmup;
                  await WorkoutStore.updateSetEntry(entrySets[i]);
                }
              }
            }
            return 'Successfully undid scheduled template workout.';
        }
      } catch (err) {
        console.error('Error in undo operation:', err);
        return 'Failed to execute undo action due to a database error.';
      }
      return 'Undo action completed.';
    }
  }
];

export async function executeAgentTool(name: string, args: Record<string, any>): Promise<string> {
  const tool = AgentTools.find(t => t.name === name);
  if (!tool) {
    return `Unknown tool: ${name}`;
  }
  try {
    return await tool.handler(args);
  } catch (err) {
    console.error(`Error executing tool ${name}:`, err);
    return `Error executing tool ${name}: ${(err as Error).message}`;
  }
}
