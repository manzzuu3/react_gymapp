import { NutritionStore } from '../database/NutritionStore';
import { Product } from '../database/types';

export class BarcodeLookup {
  static async resolveBarcode(barcode: string): Promise<Product | null> {
    const trimmed = barcode.trim();
    if (!trimmed) return null;

    // 1. Check local DB cache first
    const cached = await NutritionStore.fetchProductByBarcode(trimmed);
    if (cached) {
      console.log('Barcode cache hit:', trimmed);
      return cached;
    }

    // 2. Query Open Food Facts API
    const url = `https://world.openfoodfacts.org/api/v0/product/${trimmed}.json`;
    console.log('Barcode cache miss. Querying Open Food Facts API:', url);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'WorkoutLog - React Native Port - Version 1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.status !== 1 || !data.product) {
        console.log('Product not found in Open Food Facts API for barcode:', trimmed);
        return null;
      }

      const prodData = data.product;
      const name = prodData.product_name || `Scanned Product (${trimmed})`;
      const nutriments = prodData.nutriments || {};

      // Macros are per 100g
      const kcal = parseFloat(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0);
      const protein = parseFloat(nutriments.proteins_100g || nutriments.proteins || 0);
      const carbs = parseFloat(nutriments.carbohydrates_100g || nutriments.carbohydrates || 0);
      const fat = parseFloat(nutriments.fat_100g || nutriments.fat || 0);

      // Save to local product catalog (set isCustom = false as it is scanned/branded)
      const savedProduct = await NutritionStore.createProduct(
        name,
        kcal,
        protein,
        carbs,
        fat,
        trimmed,
        false // isCustom = false
      );

      return savedProduct;
    } catch (err) {
      console.error('Error fetching barcode from OFF API:', err);
      return null;
    }
  }
}
export default BarcodeLookup;
