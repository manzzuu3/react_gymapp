import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

let foodDbInstance: SQLite.SQLiteDatabase | null = null;

export async function initFoodCatalog(): Promise<SQLite.SQLiteDatabase> {
  if (foodDbInstance) return foodDbInstance;

  const dbName = 'foods.sqlite';
  
  if (Platform.OS === 'web') {
    foodDbInstance = await SQLite.openDatabaseAsync(dbName);
    // On web, the DB is in-memory — create the schema each time
    await foodDbInstance.execAsync(`
      CREATE TABLE IF NOT EXISTS foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        kcal REAL NOT NULL DEFAULT 0,
        protein REAL NOT NULL DEFAULT 0,
        carbs REAL NOT NULL DEFAULT 0,
        fat REAL NOT NULL DEFAULT 0,
        priority INTEGER NOT NULL DEFAULT 0
      );
    `);
    return foodDbInstance;
  }

  const dbDir = `${(FileSystem as any).documentDirectory}SQLite/`;
  const dbPath = `${dbDir}${dbName}`;

  const dirInfo = await FileSystem.getInfoAsync(dbDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
  }

  const dbInfo = await FileSystem.getInfoAsync(dbPath);
  if (!dbInfo.exists) {
    console.log('Copying foods.sqlite to document directory...');
    try {
      const asset = Asset.fromModule(require('../../assets/foods.sqlite'));
      await asset.downloadAsync();
      if (!asset.localUri) {
        throw new Error('Failed to load foods.sqlite asset localUri');
      }
      await FileSystem.copyAsync({
        from: asset.localUri,
        to: dbPath,
      });
      console.log('foods.sqlite copy complete.');
    } catch (err) {
      console.error('Error copying foods.sqlite', err);
    }
  }

  foodDbInstance = await SQLite.openDatabaseAsync(dbName);
  return foodDbInstance;
}

export interface FoodItemData {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

function escapeLike(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

export async function searchGenericFoods(query: string, limit: number = 50): Promise<FoodItemData[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const db = await initFoodCatalog();
    const esc = escapeLike(trimmed);

    const sql = `
      SELECT name, kcal, protein, carbs, fat FROM foods
      WHERE name LIKE ? ESCAPE '\\'
      ORDER BY
        CASE
          WHEN name = ? THEN 0
          WHEN name LIKE ? ESCAPE '\\' THEN 1
          WHEN name LIKE ? ESCAPE '\\' THEN 2
          ELSE 3
        END,
        priority DESC,
        length(name),
        name
      LIMIT ?;
    `;

    return await db.getAllAsync<FoodItemData>(sql, [
      `%${esc}%`,
      trimmed,
      `${esc}%`,
      `% ${esc}%`,
      limit,
    ]);
  } catch (err) {
    console.error('Error querying foods sqlite catalog', err);
    return [];
  }
}
