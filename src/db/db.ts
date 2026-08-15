import Dexie, { type Table } from 'dexie';
import { Transaction, Category, FixedExpense, Settings } from '@/types/models';

export class FinanceDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  fixedExpenses!: Table<FixedExpense, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('FinanceAppDB');
    
    // Version 2: تم التحديث ليتوافق مع نظام الهللات (Minor Units) والبصمة
    this.version(2).stores({
      transactions: 'id, date, merchant, categoryId, source, fingerprint, type',
      categories: 'id, name, type',
      fixedExpenses: 'id, dayOfMonth, categoryId',
      settings: 'id'
    });
  }
}

export const db = new FinanceDatabase();