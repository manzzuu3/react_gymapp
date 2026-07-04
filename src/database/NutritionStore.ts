import { getDb } from './db';
import { Product, FoodEntry, Meal, MealIngredient } from './types';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getProductMacros(product: { kcalPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number }, grams: number) {
  const factor = grams / 100;
  return {
    kcal: product.kcalPer100g * factor,
    proteinG: product.proteinPer100g * factor,
    carbsG: product.carbsPer100g * factor,
    fatG: product.fatPer100g * factor
  };
}

export class NutritionStore {
  // MARK: - Products
  
  static async fetchProducts(): Promise<Product[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM products ORDER BY name;');
    return rows.map(r => ({
      ...r,
      isCustom: r.isCustom === 1
    }));
  }

  static async fetchProductById(id: string): Promise<Product | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM products WHERE id = ?;', [id]);
    if (!row) return null;
    return {
      ...row,
      isCustom: row.isCustom === 1
    };
  }

  static async fetchProductByBarcode(barcode: string): Promise<Product | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM products WHERE barcode = ?;', [barcode]);
    if (!row) return null;
    return {
      ...row,
      isCustom: row.isCustom === 1
    };
  }

  static async createProduct(
    name: string, 
    kcalPer100g: number, 
    proteinPer100g: number, 
    carbsPer100g: number = 0, 
    fatPer100g: number = 0, 
    barcode?: string, 
    isCustom: boolean = true
  ): Promise<Product> {
    const db = await getDb();
    const id = barcode || 'prod_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    
    await db.runAsync(
      `INSERT OR REPLACE INTO products (id, name, kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g, barcode, isCustom)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g, barcode || null, isCustom ? 1 : 0]
    );

    return {
      id,
      name,
      kcalPer100g,
      proteinPer100g,
      carbsPer100g,
      fatPer100g,
      barcode,
      isCustom
    };
  }

  // MARK: - Food Entries
  
  static async fetchFoodEntries(date: string): Promise<FoodEntry[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM food_entries WHERE date = ? ORDER BY createdAt;',
      [date]
    );
    return rows.map(r => ({
      ...r,
      productId: r.productId || undefined,
      mealName: r.mealName || undefined
    }));
  }

  static async logFood(
    item: { name: string; kcalPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; id?: string },
    grams: number,
    date: string,
    mealName?: string
  ): Promise<FoodEntry> {
    const db = await getDb();
    const id = generateId();
    const createdAt = new Date().toISOString();
    const macros = getProductMacros(item, grams);

    await db.runAsync(
      `INSERT INTO food_entries (id, date, productId, productName, mealName, createdAt, grams, kcal, proteinG, carbsG, fatG)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        date, 
        item.id || null, 
        item.name, 
        mealName || null, 
        createdAt, 
        grams, 
        macros.kcal, 
        macros.proteinG, 
        macros.carbsG, 
        macros.fatG
      ]
    );

    return {
      id,
      date,
      productId: item.id,
      productName: item.name,
      mealName,
      createdAt,
      grams,
      kcal: macros.kcal,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG
    };
  }

  static async createAndLogProduct(
    name: string,
    kcalPer100g: number,
    proteinPer100g: number,
    carbsPer100g: number,
    fatPer100g: number,
    grams: number,
    date: string,
    barcode?: string
  ): Promise<FoodEntry> {
    const product = await this.createProduct(name, kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g, barcode);
    return this.logFood(product, grams, date);
  }

  static async updateEntry(entryId: string, grams: number): Promise<void> {
    const db = await getDb();
    const entry = await db.getFirstAsync<any>('SELECT * FROM food_entries WHERE id = ?;', [entryId]);
    if (!entry) return;

    let macros;
    if (entry.productId) {
      const product = await this.fetchProductById(entry.productId);
      if (product) {
        macros = getProductMacros(product, grams);
      }
    }

    if (!macros) {
      // Scale from current frozen snapshot if product was deleted
      const currentGrams = entry.grams || 1;
      const factor = grams / currentGrams;
      macros = {
        kcal: entry.kcal * factor,
        proteinG: entry.proteinG * factor,
        carbsG: entry.carbsG * factor,
        fatG: entry.fatG * factor
      };
    }

    await db.runAsync(
      'UPDATE food_entries SET grams = ?, kcal = ?, proteinG = ?, carbsG = ?, fatG = ? WHERE id = ?;',
      [grams, macros.kcal, macros.proteinG, macros.carbsG, macros.fatG, entryId]
    );
  }

  static async deleteEntry(entryId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM food_entries WHERE id = ?;', [entryId]);
  }

  // MARK: - Meals
  
  static async fetchMeals(): Promise<Meal[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM meals ORDER BY createdAt DESC;');
    const meals: Meal[] = [];
    for (const r of rows) {
      const ingredients = await db.getAllAsync<any>(
        'SELECT * FROM meal_ingredients WHERE mealId = ? ORDER BY orderIndex;',
        [r.id]
      );
      meals.push({
        id: r.id,
        name: r.name,
        createdAt: r.createdAt,
        ingredients: ingredients.map(ing => ({
          ...ing,
          productId: ing.productId || undefined
        }))
      });
    }
    return meals;
  }

  static async fetchMealById(id: string): Promise<Meal | null> {
    const db = await getDb();
    const r = await db.getFirstAsync<any>('SELECT * FROM meals WHERE id = ?;', [id]);
    if (!r) return null;
    const ingredients = await db.getAllAsync<any>(
      'SELECT * FROM meal_ingredients WHERE mealId = ? ORDER BY orderIndex;',
      [r.id]
    );
    return {
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      ingredients: ingredients.map(ing => ({
        ...ing,
        productId: ing.productId || undefined
      }))
    };
  }

  static async saveMeal(
    existing: Meal | null,
    name: string,
    ingredients: Omit<MealIngredient, 'id' | 'mealId'>[]
  ): Promise<Meal> {
    const db = await getDb();
    const id = existing?.id || generateId();
    const createdAt = existing?.createdAt || new Date().toISOString();

    await db.withTransactionAsync(async () => {
      // Create or update meal row
      if (!existing) {
        await db.runAsync('INSERT INTO meals (id, name, createdAt) VALUES (?, ?, ?);', [id, name, createdAt]);
      } else {
        await db.runAsync('UPDATE meals SET name = ? WHERE id = ?;', [name, id]);
      }

      // Delete old ingredients
      await db.runAsync('DELETE FROM meal_ingredients WHERE mealId = ?;', [id]);

      // Write new ingredients
      for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i];
        const ingId = generateId();
        await db.runAsync(
          `INSERT INTO meal_ingredients (id, mealId, productId, productName, grams, kcal, proteinG, carbsG, fatG, orderIndex)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ingId,
            id,
            ing.productId || null,
            ing.productName,
            ing.grams,
            ing.kcal,
            ing.proteinG,
            ing.carbsG,
            ing.fatG,
            i
          ]
        );
      }
    });

    return {
      id,
      name,
      createdAt,
      ingredients: ingredients.map((ing, i) => ({
        id: 'temp_ing_' + i,
        mealId: id,
        ...ing
      }))
    };
  }

  static async deleteMeal(mealId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM meals WHERE id = ?;', [mealId]);
  }

  static async logMeal(meal: Meal, date: string): Promise<FoodEntry[]> {
    const db = await getDb();
    const loggedEntries: FoodEntry[] = [];

    await db.withTransactionAsync(async () => {
      if (!meal.ingredients) return;
      for (const ing of meal.ingredients) {
        const entryId = generateId();
        const createdAt = new Date().toISOString();
        
        await db.runAsync(
          `INSERT INTO food_entries (id, date, productId, productName, mealName, createdAt, grams, kcal, proteinG, carbsG, fatG)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entryId,
            date,
            ing.productId || null,
            ing.productName,
            meal.name,
            createdAt,
            ing.grams,
            ing.kcal,
            ing.proteinG,
            ing.carbsG,
            ing.fatG
          ]
        );

        loggedEntries.push({
          id: entryId,
          date,
          productId: ing.productId,
          productName: ing.productName,
          mealName: meal.name,
          createdAt,
          grams: ing.grams,
          kcal: ing.kcal,
          proteinG: ing.proteinG,
          carbsG: ing.carbsG,
          fatG: ing.fatG
        });
      }
    });

    return loggedEntries;
  }
}
