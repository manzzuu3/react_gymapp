import { PersonalRecord } from './WorkoutStats';

export type BiologicalSex = 'male' | 'female';

export interface LiftScore {
  lift: string;
  displayName: string;
  e1rmKg: number;
  ratio: number;
  score: number;
}

export interface StrengthScoreResult {
  overall: number;
  level: string;
  lifts: LiftScore[];
}

export const BigLifts = {
  squat: {
    displayName: 'Squat',
    keywords: ['squat'],
    disqualifying: ['split', 'bulgarian', 'sissy', 'pistol', 'jump', 'zercher', 'jefferson', 'single', 'one leg', 'one-leg'],
    eliteRatio: (sex?: BiologicalSex) => (sex === 'female' ? 1.6 : 2.1),
    anchorFactor: (name: string) => {
      const n = name.toLowerCase();
      if (n.includes('front')) return 0.80;
      if (n.includes('hack')) return 0.90;
      if (n.includes('box')) return 0.95;
      return 1.0;
    }
  },
  bench: {
    displayName: 'Bench Press',
    keywords: ['bench'],
    disqualifying: ['guillotine', 'floor'],
    eliteRatio: (sex?: BiologicalSex) => (sex === 'female' ? 1.0 : 1.5),
    anchorFactor: (name: string) => {
      const n = name.toLowerCase();
      if (n.includes('incline')) return 0.80;
      if (n.includes('close')) return 0.90;
      if (n.includes('decline')) return 1.05;
      return 1.0;
    }
  },
  deadlift: {
    displayName: 'Deadlift',
    keywords: ['deadlift'],
    disqualifying: ['snatch', 'single', 'one leg', 'one-leg'],
    eliteRatio: (sex?: BiologicalSex) => (sex === 'female' ? 2.0 : 2.5),
    anchorFactor: (name: string) => {
      const n = name.toLowerCase();
      if (n.includes('romanian') || n.includes('stiff') || n.includes('straight')) return 0.85;
      if (n.includes('deficit')) return 0.90;
      return 1.0;
    }
  },
  overheadPress: {
    displayName: 'Overhead Press',
    keywords: ['overhead press', 'military press', 'ohp', 'shoulder press'],
    disqualifying: [],
    eliteRatio: (sex?: BiologicalSex) => (sex === 'female' ? 0.6 : 0.9),
    anchorFactor: () => 1.0
  }
};

const nonBarbellNameHints = [
  'dumbbell', 'kettlebell', 'smith', 'machine', 'cable',
  'goblet', 'band', 'bodyweight', 'body only', 'landmine',
];

function isBarbell(record: PersonalRecord): boolean {
  if (record.equipment) {
    return record.equipment === 'barbell';
  }
  const name = record.exerciseName.toLowerCase();
  return !nonBarbellNameHints.some(hint => name.includes(hint));
}

function matchesLift(liftKey: keyof typeof BigLifts, name: string): boolean {
  const n = name.toLowerCase();
  const lift = BigLifts[liftKey];
  const hitKeyword = lift.keywords.some(kw => n.includes(kw));
  const hitDisqualifier = lift.disqualifying.some(dq => n.includes(dq));
  return hitKeyword && !hitDisqualifier;
}

export class StrengthScore {
  static compute(
    records: PersonalRecord[],
    bodyweightKg: number,
    sex?: BiologicalSex
  ): StrengthScoreResult | null {
    if (bodyweightKg <= 0) return null;

    const liftScores: LiftScore[] = [];

    for (const key of Object.keys(BigLifts) as (keyof typeof BigLifts)[]) {
      const lift = BigLifts[key];
      
      // Filter records matching this lift
      const matchingRecords = records.filter(
        rec => matchesLift(key, rec.exerciseName) && isBarbell(rec) && rec.bestOneRMKg > 0
      );

      if (matchingRecords.length === 0) continue;

      // Find the record with the maximum score
      let bestLiftScore: LiftScore | null = null;

      for (const rec of matchingRecords) {
        const e1rm = rec.bestOneRMKg;
        const ratio = e1rm / bodyweightKg;
        const anchor = lift.eliteRatio(sex) * lift.anchorFactor(rec.exerciseName);
        const score = Math.min(100, Math.max(0, (ratio / anchor) * 100));

        const ls: LiftScore = {
          lift: key,
          displayName: lift.displayName,
          e1rmKg: e1rm,
          ratio,
          score
        };

        if (!bestLiftScore || score > bestLiftScore.score) {
          bestLiftScore = ls;
        }
      }

      if (bestLiftScore) {
        liftScores.push(bestLiftScore);
      }
    }

    if (liftScores.length === 0) return null;

    const overall = liftScores.reduce((sum, item) => sum + item.score, 0) / liftScores.length;
    let level = 'Beginner';
    if (overall < 20) level = 'Beginner';
    else if (overall < 40) level = 'Novice';
    else if (overall < 60) level = 'Intermediate';
    else if (overall < 80) level = 'Advanced';
    else level = 'Elite';

    return {
      overall,
      level,
      lifts: liftScores.sort((a, b) => b.score - a.score)
    };
  }
}
