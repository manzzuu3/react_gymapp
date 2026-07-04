import { WorkoutStore } from '../database/WorkoutStore';
import { getDb } from '../database/db';
import { TrainingPlan, Workout, WorkoutDay } from '../database/types';
import { DateHelpers } from './DateHelpers';

export interface Slot {
  date: string; // 'YYYY-MM-DD'
  assignment: {
    type: 'session' | 'skipped';
    workout?: Workout;
  };
}

export class WorkoutScheduler {
  static readonly horizonWeeks = 12;

  static getTodayStr(): string {
    return DateHelpers.toISODateString(DateHelpers.getLocalStartOfDay(new Date()));
  }

  static getHorizonStr(todayStr: string): string {
    const today = DateHelpers.parseISODate(todayStr)!;
    return DateHelpers.toISODateString(DateHelpers.addDays(today, this.horizonWeeks * 7));
  }

  static occurrenceDates(plan: TrainingPlan, horizonStr: string): string[] {
    if (!plan.scheduleStart || plan.scheduleWeekdaysMask === 0) return [];
    
    const startDay = plan.scheduleStart.substring(0, 10); // 'YYYY-MM-DD'
    const startDate = DateHelpers.parseISODate(startDay)!;

    let endExclusiveDate: Date;
    switch (plan.scheduleDurationRaw) {
      case 'weeks':
        endExclusiveDate = DateHelpers.addDays(startDate, Math.max(1, plan.scheduleWeeks) * 7);
        break;
      case 'untilDate':
        const end = plan.scheduleEnd ? plan.scheduleEnd.substring(0, 10) : startDay;
        endExclusiveDate = DateHelpers.addDays(DateHelpers.parseISODate(end)!, 1);
        break;
      case 'ongoing':
        const horizon = DateHelpers.parseISODate(horizonStr)!;
        endExclusiveDate = DateHelpers.addDays(horizon, 1);
        break;
      default:
        endExclusiveDate = DateHelpers.addDays(startDate, 6 * 7);
    }

    const endExclusiveStr = DateHelpers.toISODateString(endExclusiveDate);
    if (endExclusiveStr <= startDay) return [];

    // Build plan weekdays set
    const weekdays = new Set<number>();
    for (let i = 0; i < 7; i++) {
      if ((plan.scheduleWeekdaysMask & (1 << i)) !== 0) {
        weekdays.add(i); // 0 = Monday, ..., 6 = Sunday
      }
    }

    const result: string[] = [];
    let day = startDate;
    let dayStr = DateHelpers.toISODateString(day);

    while (dayStr < endExclusiveStr) {
      if (weekdays.has(DateHelpers.mondayFirstWeekdayIndex(day))) {
        result.push(dayStr);
      }
      day = DateHelpers.addDays(day, 1);
      dayStr = DateHelpers.toISODateString(day);
    }

    if (plan.scheduleDurationRaw !== 'ongoing' && result.length > 0) {
      const slideDates = new Set(plan.skipEvents.filter(s => s.slides).map(s => s.date));
      // Extend series one slot per slide event
      let owed = result.filter(d => slideDates.has(d)).length;
      let lastStr = result[result.length - 1];
      let lastDate = DateHelpers.parseISODate(lastStr)!;

      while (owed > 0) {
        lastDate = this.nextDayMatching(weekdays, lastDate);
        lastStr = DateHelpers.toISODateString(lastDate);
        result.push(lastStr);
        owed -= 1;
        if (slideDates.has(lastStr)) {
          owed += 1;
        }
      }
    }

    return result;
  }

  private static nextDayMatching(weekdays: Set<number>, date: Date): Date {
    let day = DateHelpers.addDays(date, 1);
    while (!weekdays.has(DateHelpers.mondayFirstWeekdayIndex(day))) {
      day = DateHelpers.addDays(day, 1);
    }
    return day;
  }

  static slots(plan: TrainingPlan, horizonStr: string): Slot[] {
    const rotation = plan.rotation || [];
    const skipsByDate = new Map<string, boolean>();
    for (const sk of plan.skipEvents) {
      skipsByDate.set(sk.date, sk.slides);
    }

    let consumed = 0;
    const result: Slot[] = [];
    const dates = this.occurrenceDates(plan, horizonStr);

    for (const dStr of dates) {
      const next = rotation.length === 0 ? undefined : rotation[consumed % rotation.length];
      if (skipsByDate.has(dStr)) {
        const slides = skipsByDate.get(dStr)!;
        result.push({
          date: dStr,
          assignment: { type: 'skipped', workout: next }
        });
        if (!slides) consumed += 1;
      } else if (next) {
        result.push({
          date: dStr,
          assignment: { type: 'session', workout: next }
        });
        consumed += 1;
      }
    }

    return result;
  }

  static async schedulePlan(plan: TrainingPlan): Promise<void> {
    const today = this.getTodayStr();
    const horizon = this.getHorizonStr(today);
    const slots = this.slots(plan, horizon);
    const covered = new Set(slots.map(s => s.date).filter(d => d >= today));

    for (const slot of slots) {
      if (slot.date < today) continue;

      let day = await WorkoutStore.fetchWorkoutDayWithEntries(slot.date);
      if (!day) {
        day = await WorkoutStore.createWorkoutDay(slot.date);
      }

      if (slot.assignment.type === 'session') {
        const workout = slot.assignment.workout;
        if (workout) {
          day.isSkipped = false;
          // Progress: done sets count
          const doneSets = day.entries?.flatMap(e => e.sets || []).filter(s => s.isDone).length || 0;
          if (!day.isOverridden && doneSets === 0) {
            await this.stamp(day, workout);
          } else {
            await WorkoutStore.updateWorkoutDay(day);
          }
        }
      } else {
        // Skipped slot
        const doneSets = day.entries?.flatMap(e => e.sets || []).filter(s => s.isDone).length || 0;
        if (doneSets === 0) {
          day.isSkipped = true;
          if (!day.isOverridden) {
            // Delete all entries
            if (day.entries) {
              for (const entry of day.entries) {
                await WorkoutStore.deleteExerciseEntry(entry.id);
              }
            }
            day.entries = [];
            const wouldBe = slot.assignment.workout;
            if (wouldBe) {
              day.title = wouldBe.name;
              day.typeRaw = wouldBe.typeRaw;
              day.sourceWorkoutId = wouldBe.id;
            }
          }
          await WorkoutStore.updateWorkoutDay(day);
        }
      }
    }

    // Clean up future days that fell off schedule
    const rotationIds = new Set((plan.rotation || []).map(w => w.id));
    // Fetch all future workout days
    const futureDays = await WorkoutStore.fetchWorkoutDaysRange(today, '2099-12-31');
    for (const day of futureDays) {
      if (day.sourceWorkoutId && rotationIds.has(day.sourceWorkoutId) && !day.isOverridden) {
        const doneSets = (await WorkoutStore.fetchWorkoutDayWithEntries(day.date))?.entries?.flatMap(e => e.sets || []).filter(s => s.isDone).length || 0;
        if (doneSets === 0 && !covered.has(day.date)) {
          await WorkoutStore.deleteWorkoutDay(day.id);
        }
      }
    }
  }

  static async propagate(workout: Workout): Promise<void> {
    if (!workout.planId) return;
    const plan = await WorkoutStore.fetchTrainingPlan(workout.planId);
    if (plan) {
      // Load plan rotation
      const allWorkouts = await WorkoutStore.fetchWorkouts();
      plan.rotation = allWorkouts.filter(w => w.planId === plan.id);
      await this.schedulePlan(plan);
    }
  }

  static async skip(day: WorkoutDay, slides: boolean): Promise<void> {
    if (!day.sourceWorkoutId) return;
    const workout = await WorkoutStore.fetchWorkoutDetail(day.sourceWorkoutId);
    if (!workout || !workout.planId) return;

    const plan = await WorkoutStore.fetchTrainingPlan(workout.planId);
    if (!plan) return;

    // Load rotation
    const allWorkouts = await WorkoutStore.fetchWorkouts();
    plan.rotation = allWorkouts.filter(w => w.planId === plan.id);

    // Filter skips and append new one
    plan.skipEvents = plan.skipEvents.filter(sk => sk.date !== day.date);
    plan.skipEvents.push({ date: day.date, slides });
    
    await WorkoutStore.updateTrainingPlan(plan);
    await this.schedulePlan(plan);
  }

  static async unskip(day: WorkoutDay): Promise<void> {
    if (!day.sourceWorkoutId) return;
    const workout = await WorkoutStore.fetchWorkoutDetail(day.sourceWorkoutId);
    if (!workout || !workout.planId) return;

    const plan = await WorkoutStore.fetchTrainingPlan(workout.planId);
    if (!plan) return;

    // Load rotation
    const allWorkouts = await WorkoutStore.fetchWorkouts();
    plan.rotation = allWorkouts.filter(w => w.planId === plan.id);

    // Drop skip event
    plan.skipEvents = plan.skipEvents.filter(sk => sk.date !== day.date);
    
    await WorkoutStore.updateTrainingPlan(plan);
    await this.schedulePlan(plan);
  }

  static async resetToTemplate(day: WorkoutDay): Promise<void> {
    if (!day.sourceWorkoutId) return;
    const workout = await WorkoutStore.fetchWorkoutDetail(day.sourceWorkoutId);
    if (workout) {
      await this.stamp(day, workout);
    }
  }

  static async topUpOngoing(): Promise<void> {
    // Top up all ongoing plans
    const db = await getDb();
    const planRows = await db.getAllAsync<any>("SELECT * FROM training_plans WHERE scheduleDurationRaw = 'ongoing';");
    const allWorkouts = await WorkoutStore.fetchWorkouts();

    for (const r of planRows) {
      const plan: TrainingPlan = {
        id: r.id,
        scheduleWeekdaysMask: r.scheduleWeekdaysMask,
        scheduleStart: r.scheduleStart || undefined,
        scheduleDurationRaw: r.scheduleDurationRaw,
        scheduleWeeks: r.scheduleWeeks,
        scheduleEnd: r.scheduleEnd || undefined,
        skipEvents: r.skipEvents ? JSON.parse(r.skipEvents) : [],
        rotation: allWorkouts.filter(w => w.planId === r.id)
      };
      
      if (plan.scheduleStart && plan.rotation && plan.rotation.length > 0) {
        await this.schedulePlan(plan);
      }
    }
  }

  static async stamp(day: WorkoutDay, workout: Workout): Promise<void> {
    // 1. Delete all existing entries for this day
    const fullDay = await WorkoutStore.fetchWorkoutDayWithEntries(day.date);
    if (fullDay && fullDay.entries) {
      for (const entry of fullDay.entries) {
        await WorkoutStore.deleteExerciseEntry(entry.id);
      }
    }

    // 2. Set day metadata
    day.title = workout.name;
    day.typeRaw = workout.typeRaw;
    day.sourceWorkoutId = workout.id;
    day.isOverridden = false;
    day.isSkipped = false;
    
    await WorkoutStore.updateWorkoutDay(day);

    // Fetch full workout exercises
    const exercises = await WorkoutStore.fetchTemplateExercises(workout.id);
    
    // 3. Materialize each exercise
    for (let index = 0; index < exercises.length; index++) {
      const temp = exercises[index];
      // Get catalogs to find muscleGroup/secondary text
      let muscleGroupRaw = undefined;
      let secondaryMuscleGroupsRaw = undefined;
      
      if (temp.exerciseId) {
        const catalogEx = await WorkoutStore.fetchExerciseById(temp.exerciseId);
        if (catalogEx) {
          muscleGroupRaw = catalogEx.muscleGroupRaw;
          secondaryMuscleGroupsRaw = catalogEx.secondaryMusclesText;
        }
      }

      await WorkoutStore.addExerciseToDay(
        day.id,
        temp.exerciseId,
        temp.exerciseName,
        muscleGroupRaw,
        secondaryMuscleGroupsRaw,
        index,
        temp.targetSets,
        temp.targetReps,
        temp.targetWeightKg,
        temp.supersetGroup
      );
    }
  }

  static async dayFor(date: Date): Promise<WorkoutDay> {
    const dateStr = DateHelpers.toISODateString(date);
    let day = await WorkoutStore.fetchWorkoutDayWithEntries(dateStr);
    if (!day) {
      day = await WorkoutStore.createWorkoutDay(dateStr);
    }
    return day;
  }
}
export default WorkoutScheduler;
