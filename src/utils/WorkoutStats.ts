import { WorkoutDay, SetEntry, ExerciseEntry } from '../database/types';
import { DateHelpers } from './DateHelpers';

export interface TrendPoint {
  date: string; // 'YYYY-MM-DD'
  value: number;
}

export interface WeekStat {
  weekStart: string; // 'YYYY-MM-DD'
  volumeKg: number;
  sessions: number;
}

export interface ConsistencyStats {
  currentStreak: number;
  longestStreak: number;
  activeWeeks: number;
  totalSessions: number;
  avgSessionsPerWeek: number;
}

export interface MuscleVolume {
  group: string;
  sets: number;
  volumeKg: number;
}

export interface MuscleWeeklyVolume {
  group: string;
  setsPerWeek: number;
}

export interface PersonalRecord {
  exerciseName: string;
  heaviestKg: number;
  bestOneRMKg: number;
  bestSetVolumeKg: number;
  bestOneRMDate: string; // 'YYYY-MM-DD'
  equipment?: string;
}

export class BodyweightSeries {
  private points: { date: string; kg: number }[] = [];

  constructor(points: { date: string; kg: number }[]) {
    this.points = points
      .filter(p => p.kg > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  weightKg(onDate: string): number | null {
    let latest: number | null = null;
    for (const p of this.points) {
      if (p.date <= onDate) {
        latest = p.kg;
      } else {
        break;
      }
    }
    return latest;
  }
}

export class WorkoutStats {
  static readonly e1rmRepCap = 15;
  static readonly secondaryMuscleWeight = 0.5;
  static readonly bodyOnlyEquipment = 'body only';

  static isWorkingSet(set: SetEntry): boolean {
    return set.isDone && !set.isWarmup;
  }

  static setVolumeKg(set: SetEntry): number {
    return (set.weightKg ?? 0) * (set.reps ?? 0);
  }

  static oneRepMaxKg(loadKg: number, reps: number): number {
    if (reps <= 0 || reps > this.e1rmRepCap) return 0;
    return loadKg * (1 + reps / 30);
  }

  static effectiveLoadKg(set: SetEntry, equipment: string | undefined, onDate: string, bodyweight?: BodyweightSeries): number {
    const logged = set.weightKg ?? 0;
    if (equipment === this.bodyOnlyEquipment && bodyweight) {
      const bw = bodyweight.weightKg(onDate);
      if (bw !== null) {
        return bw + logged;
      }
    }
    return logged;
  }

  static muscleContributions(entry: ExerciseEntry, muscleGroupMap?: Record<string, { muscleGroupRaw: string, secondaryMuscleGroupsRaw?: string }>): { group: string; weight: number }[] {
    const primary = entry.muscleGroupRaw;
    if (!primary) return [];

    const contribs = [{ group: primary, weight: 1.0 }];

    if (entry.secondaryMuscleGroupsRaw) {
      const secondaries = entry.secondaryMuscleGroupsRaw
        .split('\n')
        .map(s => s.trim())
        .filter(s => s && s !== primary);
      
      for (const sec of secondaries) {
        contribs.push({ group: sec, weight: this.secondaryMuscleWeight });
      }
    }

    return contribs;
  }

  // MARK: - Weekly volume + frequency
  static weeklyTotals(
    days: WorkoutDay[],
    weekStartFn: (d: Date) => Date = (d) => DateHelpers.startOfWeek(d, true)
  ): WeekStat[] {
    const trained = days.filter(d => d.entries?.some(e => e.sets?.some(s => s.isDone)) ?? false);
    
    // Group by week start date string
    const groups: Record<string, WorkoutDay[]> = {};
    for (const d of trained) {
      const dateObj = DateHelpers.parseISODate(d.date) || new Date(d.date);
      const wStart = DateHelpers.toISODateString(weekStartFn(dateObj));
      if (!groups[wStart]) groups[wStart] = [];
      groups[wStart].push(d);
    }

    return Object.keys(groups)
      .map(wStart => {
        const group = groups[wStart];
        let volume = 0;
        for (const day of group) {
          if (!day.entries) continue;
          for (const ent of day.entries) {
            if (!ent.sets) continue;
            for (const s of ent.sets) {
              if (this.isWorkingSet(s)) {
                volume += this.setVolumeKg(s);
              }
            }
          }
        }
        return {
          weekStart: wStart,
          volumeKg: volume,
          sessions: group.length
        };
      })
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }

  // MARK: - Weekly RPE / intensity
  static weeklyAverageRPE(
    days: WorkoutDay[],
    weekStartFn: (d: Date) => Date = (d) => DateHelpers.startOfWeek(d, true)
  ): TrendPoint[] {
    const byWeek: Record<string, { sum: number; count: number }> = {};
    
    for (const day of days) {
      if (!day.entries) continue;
      const dateObj = DateHelpers.parseISODate(day.date) || new Date(day.date);
      const wStart = DateHelpers.toISODateString(weekStartFn(dateObj));

      for (const ent of day.entries) {
        if (!ent.sets) continue;
        for (const s of ent.sets) {
          if (this.isWorkingSet(s) && s.rpe !== undefined && s.rpe !== null) {
            if (!byWeek[wStart]) byWeek[wStart] = { sum: 0, count: 0 };
            byWeek[wStart].sum += s.rpe;
            byWeek[wStart].count += 1;
          }
        }
      }
    }

    return Object.keys(byWeek)
      .map(wStart => ({
        date: wStart,
        value: byWeek[wStart].sum / byWeek[wStart].count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // MARK: - Streak / consistency
  static consistency(
    days: WorkoutDay[],
    weekStartFn: (d: Date) => Date = (d) => DateHelpers.startOfWeek(d, true),
    currentWeekStr?: string
  ): ConsistencyStats {
    const weeks = this.weeklyTotals(days, weekStartFn);
    if (weeks.length === 0) {
      return { currentStreak: 0, longestStreak: 0, activeWeeks: 0, totalSessions: 0, avgSessionsPerWeek: 0 };
    }

    const trainedWeeks = new Set(weeks.map(w => w.weekStart));
    const totalSessions = weeks.reduce((sum, w) => sum + w.sessions, 0);

    const refDate = currentWeekStr 
      ? DateHelpers.parseISODate(currentWeekStr)! 
      : weekStartFn(new Date());
    const currentWeek = DateHelpers.toISODateString(refDate);
    const prevWeek = DateHelpers.toISODateString(DateHelpers.addDays(refDate, -7));

    // Longest streak
    let longest = 1;
    let run = 1;
    for (let i = 1; i < weeks.length; i++) {
      const prevDate = DateHelpers.parseISODate(weeks[i - 1].weekStart)!;
      const expectedNext = DateHelpers.toISODateString(DateHelpers.addDays(prevDate, 7));
      if (weeks[i].weekStart === expectedNext) {
        run += 1;
      } else {
        run = 1;
      }
      longest = Math.max(longest, run);
    }

    // Current streak
    let anchor: string | null = null;
    if (trainedWeeks.has(currentWeek)) {
      anchor = currentWeek;
    } else if (trainedWeeks.has(prevWeek)) {
      anchor = prevWeek;
    }

    let current = 0;
    if (anchor) {
      let cur = DateHelpers.parseISODate(anchor)!;
      let curStr = DateHelpers.toISODateString(cur);
      while (trainedWeeks.has(curStr)) {
        current += 1;
        cur = DateHelpers.addDays(cur, -7);
        curStr = DateHelpers.toISODateString(cur);
      }
    }

    // Span weeks
    const firstWeek = DateHelpers.parseISODate(weeks[0].weekStart)!;
    const diffMs = refDate.getTime() - firstWeek.getTime();
    const spanWeeks = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24 * 7)) + 1);

    return {
      currentStreak: current,
      longestStreak: longest,
      activeWeeks: weeks.length,
      totalSessions,
      avgSessionsPerWeek: totalSessions / spanWeeks
    };
  }

  // MARK: - Per-muscle volume split
  static muscleBreakdown(days: WorkoutDay[]): MuscleVolume[] {
    const sets: Record<string, number> = {};
    const volume: Record<string, number> = {};

    for (const day of days) {
      if (!day.entries) continue;
      for (const ent of day.entries) {
        const contributions = this.muscleContributions(ent);
        if (contributions.length === 0) continue;

        if (!ent.sets) continue;
        for (const s of ent.sets) {
          if (this.isWorkingSet(s)) {
            const setVol = this.setVolumeKg(s);
            for (const { group, weight } of contributions) {
              sets[group] = (sets[group] || 0) + weight;
              volume[group] = (volume[group] || 0) + setVol * weight;
            }
          }
        }
      }
    }

    return Object.keys(sets)
      .map(group => ({
        group,
        sets: sets[group],
        volumeKg: volume[group] || 0
      }))
      .sort((a, b) => {
        if (Math.abs(a.sets - b.sets) > 0.01) {
          return b.sets - a.sets; // Descending sets
        }
        return a.group.localeCompare(b.group); // Alphabetical tiebreak
      });
  }

  // MARK: - Weekly muscle volume MEV/MAV/MRV landmarks
  static weeklyMuscleVolume(
    days: WorkoutDay[],
    weekStartFn: (d: Date) => Date = (d) => DateHelpers.startOfWeek(d, true)
  ): MuscleWeeklyVolume[] {
    const setsByGroup: Record<string, number> = {};
    const weeksByGroup: Record<string, Set<string>> = {};

    for (const day of days) {
      if (!day.entries) continue;
      const dateObj = DateHelpers.parseISODate(day.date) || new Date(day.date);
      const wStart = DateHelpers.toISODateString(weekStartFn(dateObj));

      for (const ent of day.entries) {
        if (!ent.sets) continue;
        const doneCount = ent.sets.filter(this.isWorkingSet).length;
        if (doneCount === 0) continue;

        const contributions = this.muscleContributions(ent);
        for (const { group, weight } of contributions) {
          setsByGroup[group] = (setsByGroup[group] || 0) + doneCount * weight;
          if (!weeksByGroup[group]) weeksByGroup[group] = new Set();
          weeksByGroup[group].add(wStart);
        }
      }
    }

    return Object.keys(setsByGroup)
      .map(group => {
        const weeks = Math.max(1, weeksByGroup[group]?.size || 1);
        return {
          group,
          setsPerWeek: setsByGroup[group] / weeks
        };
      })
      .sort((a, b) => {
        if (Math.abs(a.setsPerWeek - b.setsPerWeek) > 0.01) {
          return b.setsPerWeek - a.setsPerWeek;
        }
        return a.group.localeCompare(b.group);
      });
  }

  // MARK: - Estimated 1RM progression
  static oneRMProgression(
    exerciseName: string,
    days: WorkoutDay[],
    bodyweight?: BodyweightSeries
  ): TrendPoint[] {
    const points: TrendPoint[] = [];

    for (const day of days) {
      if (!day.entries) continue;
      const matchingEntries = day.entries.filter(e => e.exerciseName === exerciseName);
      if (matchingEntries.length === 0) continue;

      let best1RM = 0;
      for (const ent of matchingEntries) {
        if (!ent.sets) continue;
        for (const s of ent.sets) {
          if (this.isWorkingSet(s)) {
            // Find equipment from entry metadata if present
            const load = this.effectiveLoadKg(s, ent.muscleGroupRaw === 'body only' ? 'body only' : undefined, day.date, bodyweight);
            const e1rm = this.oneRepMaxKg(load, s.reps ?? 0);
            best1RM = Math.max(best1RM, e1rm);
          }
        }
      }

      if (best1RM > 0) {
        points.push({
          date: day.date,
          value: best1RM
        });
      }
    }

    return points.sort((a, b) => a.date.localeCompare(b.date));
  }

  // MARK: - Personal records
  static personalRecords(days: WorkoutDay[], bodyweight?: BodyweightSeries): PersonalRecord[] {
    const byName: Record<string, {
      heaviest: number;
      heaviestDate: string;
      oneRM: number;
      oneRMDate: string;
      setVol: number;
      equipment?: string;
    }> = {};

    for (const day of days) {
      if (!day.entries) continue;
      for (const ent of day.entries) {
        if (!ent.sets) continue;
        for (const s of ent.sets) {
          if (this.isWorkingSet(s)) {
            const load = this.effectiveLoadKg(s, ent.muscleGroupRaw === 'body only' ? 'body only' : undefined, day.date, bodyweight);
            if (load <= 0) continue;

            const oneRM = this.oneRepMaxKg(load, s.reps ?? 0);
            const setVol = load * (s.reps ?? 0);

            const name = ent.exerciseName;
            if (!byName[name]) {
              byName[name] = {
                heaviest: load,
                heaviestDate: day.date,
                oneRM,
                oneRMDate: day.date,
                setVol,
                equipment: ent.muscleGroupRaw === 'body only' ? 'body only' : undefined // fallback
              };
            } else {
              const cur = byName[name];
              if (load > cur.heaviest) {
                cur.heaviest = load;
                cur.heaviestDate = day.date;
              }
              if (oneRM > cur.oneRM) {
                cur.oneRM = oneRM;
                cur.oneRMDate = day.date;
              }
              cur.setVol = Math.max(cur.setVol, setVol);
            }
          }
        }
      }
    }

    return Object.keys(byName)
      .map(name => {
        const r = byName[name];
        const prDate = r.oneRM > 0 ? r.oneRMDate : r.heaviestDate;
        return {
          exerciseName: name,
          heaviestKg: r.heaviest,
          bestOneRMKg: r.oneRM,
          bestSetVolumeKg: r.setVol,
          bestOneRMDate: prDate,
          equipment: r.equipment
        };
      })
      .sort((a, b) => b.bestOneRMDate.localeCompare(a.bestOneRMDate));
  }

  static mostTrainedLifts(days: WorkoutDay[], limit: number = 8): string[] {
    const sessions: Record<string, Set<string>> = {};
    for (const day of days) {
      if (!day.entries) continue;
      for (const ent of day.entries) {
        if (ent.sets?.some(s => s.isDone)) {
          if (!sessions[ent.exerciseName]) sessions[ent.exerciseName] = new Set();
          sessions[ent.exerciseName].add(day.date);
        }
      }
    }

    return Object.keys(sessions)
      .sort((a, b) => {
        const aCount = sessions[a].size;
        const bCount = sessions[b].size;
        if (aCount !== bCount) return bCount - aCount;
        return a.localeCompare(b);
      })
      .slice(0, limit);
  }
}
