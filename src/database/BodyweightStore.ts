import { getDb } from './db';
import { BodyweightEntry } from './types';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export class BodyweightStore {
  static async fetchBodyweightEntries(): Promise<BodyweightEntry[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM bodyweight_entries ORDER BY date;');
    return rows;
  }

  static async fetchBodyweightEntry(date: string): Promise<BodyweightEntry | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM bodyweight_entries WHERE date = ?;', [date]);
    return row || null;
  }

  static async saveBodyweight(date: string, weightKg: number): Promise<BodyweightEntry> {
    const db = await getDb();
    const id = generateId();
    await db.runAsync(
      'INSERT OR REPLACE INTO bodyweight_entries (id, date, weightKg) VALUES (?, ?, ?);',
      [id, date, weightKg]
    );
    return { id, date, weightKg };
  }

  static async deleteBodyweight(date: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM bodyweight_entries WHERE date = ?;', [date]);
  }
}
