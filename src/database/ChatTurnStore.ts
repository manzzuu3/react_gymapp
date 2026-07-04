import { getDb } from './db';
import { ChatTurn } from './types';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export class ChatTurnStore {
  static async fetchChatTurns(): Promise<ChatTurn[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM chat_turns ORDER BY orderIndex;');
    return rows;
  }

  static async addChatTurn(roleRaw: 'user' | 'assistant', text: string): Promise<ChatTurn> {
    const db = await getDb();
    const id = generateId();
    const createdAt = new Date().toISOString();
    
    // Get next order index
    const maxOrder = await db.getFirstAsync<{ maxOrder: number | null }>('SELECT MAX(orderIndex) as maxOrder FROM chat_turns;');
    const orderIndex = (maxOrder?.maxOrder ?? -1) + 1;

    await db.runAsync(
      'INSERT INTO chat_turns (id, roleRaw, text, createdAt, orderIndex) VALUES (?, ?, ?, ?, ?);',
      [id, roleRaw, text, createdAt, orderIndex]
    );

    return { id, roleRaw, text, createdAt, orderIndex };
  }

  static async clearChatTurns(): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM chat_turns;');
  }
}
