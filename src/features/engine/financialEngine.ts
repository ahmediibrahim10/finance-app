// src/features/engine/financialEngine.ts

import { db } from '@/db';
import { 
  startOfMonth, 
  endOfMonth, 
  differenceInDays, 
  startOfDay, 
  endOfDay 
} from 'date-fns';

export interface DailyFinancialStatus {
  safeToSpend: number;
  spentToday: number;
  remainingToday: number;
  status: 'SAFE' | 'WARNING' | 'DANGER';
}

export async function calculateSafeToSpend(): Promise<DailyFinancialStatus> {
  const now = new Date();
  
  // 1. جلب الإعدادات (الدخل الشهري)
  const settings = await db.settings.get('user_settings');
  const income = settings?.monthlyIncome || 0;

  // 2. جلب المصاريف الثابتة
  const fixedExpenses = await db.fixedExpenses.toArray();
  const totalFixed = fixedExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  // 3. حسابات التواريخ (بداية ونهاية الشهر)
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const totalDaysInMonth = differenceInDays(monthEnd, monthStart) + 1;
  const daysPassedBeforeToday = differenceInDays(now, monthStart); 
  const remainingDays = totalDaysInMonth - daysPassedBeforeToday; // يشمل اليوم الحالي

  // 4. جلب كل عمليات الصرف لهذا الشهر
  const transactions = await db.transactions
    .where('date')
    .between(monthStart, monthEnd, true, true)
    .filter(t => t.type === 'expense')
    .toArray();

  // 5. فصل المصاريف (ما قبل اليوم VS اليوم)
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  let spentBeforeToday = 0;
  let spentToday = 0;

  transactions.forEach(t => {
    if (t.date >= todayStart && t.date <= todayEnd) {
      spentToday += t.amount;
    } else if (t.date < todayStart) {
      spentBeforeToday += t.amount;
    }
  });

  // 6. الحسابات المالية (Financial Math)
  const discretionaryBudget = income - totalFixed;
  const remainingMoneyForRestOfMonth = discretionaryBudget - spentBeforeToday;

  // الحد الآمن لليوم
  const safeToSpend = remainingDays > 0 
    ? remainingMoneyForRestOfMonth / remainingDays 
    : remainingMoneyForRestOfMonth;

  const remainingToday = safeToSpend - spentToday;

  // 7. تحديد الحالة (Status)
  let status: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';
  
  if (remainingToday < 0) {
    status = 'DANGER'; // صرفت أكثر من المسموح لليوم
  } else if (remainingToday < (safeToSpend * 0.2)) {
    status = 'WARNING'; // تبقى أقل من 20% من ميزانية اليوم
  }

  return {
    safeToSpend: Number(safeToSpend.toFixed(2)),
    spentToday: Number(spentToday.toFixed(2)),
    remainingToday: Number(remainingToday.toFixed(2)),
    status
  };
}