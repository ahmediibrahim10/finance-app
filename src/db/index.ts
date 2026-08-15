// src/db/index.ts

import Dexie, { Table } from 'dexie';
import { Transaction, Category, FixedExpense, AppSettings } from '@/types/models';

export class FinanceDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  fixedExpenses!: Table<FixedExpense, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('PersonalFinanceDB');
    
    // تعريف الـ Schema (الحقول التي يمكن البحث والترتيب بها)
    this.version(1).stores({
      transactions: 'id, date, categoryId, type',
      categories: 'id, type',
      fixedExpenses: 'id, dayOfMonth',
      settings: 'id'
    });

    // تشغيل هذه الوظيفة فقط عند إنشاء قاعدة البيانات لأول مرة
    this.on('populate', () => this.populateInitialData());
  }

  private async populateInitialData() {
    // 1. إضافة التصنيفات الافتراضية
    const defaultCategories: Category[] = [
      { id: 'cat_food', name: 'Food', icon: '🍔', color: '#F59E0B', type: 'expense', isDefault: true },
      { id: 'cat_coffee', name: 'Coffee', icon: '☕', color: '#78350F', type: 'expense', isDefault: true },
      { id: 'cat_restaurants', name: 'Restaurants', icon: '🍽️', color: '#EF4444', type: 'expense', isDefault: true },
      { id: 'cat_groceries', name: 'Groceries', icon: '🛒', color: '#10B981', type: 'expense', isDefault: true },
      { id: 'cat_transport', name: 'Transport', icon: '🚗', color: '#3B82F6', type: 'expense', isDefault: true },
      { id: 'cat_shopping', name: 'Shopping', icon: '🛍️', color: '#EC4899', type: 'expense', isDefault: true },
      { id: 'cat_bills', name: 'Bills', icon: '📄', color: '#6366F1', type: 'expense', isDefault: true },
      { id: 'cat_subscriptions', name: 'Subscriptions', icon: '🔄', color: '#8B5CF6', type: 'expense', isDefault: true },
      { id: 'cat_entertainment', name: 'Entertainment', icon: '🎬', color: '#14B8A6', type: 'expense', isDefault: true },
      { id: 'cat_education', name: 'Education', icon: '📚', color: '#F97316', type: 'expense', isDefault: true },
      { id: 'cat_health', name: 'Health', icon: '💊', color: '#F43F5E', type: 'expense', isDefault: true },
      { id: 'cat_travel', name: 'Travel', icon: '✈️', color: '#0EA5E9', type: 'expense', isDefault: true },
      { id: 'cat_other', name: 'Other', icon: '📦', color: '#64748B', type: 'expense', isDefault: true },
      
      // الدخل
      { id: 'cat_salary', name: 'Salary', icon: '💰', color: '#22C55E', type: 'income', isDefault: true },
    ];

    await this.categories.bulkAdd(defaultCategories);

    // 2. إضافة إعدادات افتراضية
    await this.settings.add({
      id: 'user_settings',
      monthlyIncome: 0,
      currency: 'SAR',
      budgetPeriodStartDay: 1,
      theme: 'system'
    });
  }
}

export const db = new FinanceDB();