import { db } from '@/db';
import { startOfMonth, endOfMonth, differenceInCalendarDays, startOfDay, endOfDay } from 'date-fns';

export interface DailyFinancialStatus {
  safeToSpend: number;
  spentToday: number;
  remainingToday: number;
  status: 'SAFE' | 'WARNING' | 'DANGER';
}

export async function calculateSafeToSpend(now = new Date()): Promise<DailyFinancialStatus> {
  const settings = await db.settings.get('user_settings');
  const incomeMinor = settings?.monthlyIncomeMinor ?? 0;

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const fixedExpenses = await db.fixedExpenses.toArray();
  const monthlyFixedMinor = fixedExpenses.reduce(
    (sum, expense) => sum + (Number(expense.amountMinor) || 0),
    0,
  );

  const transactions = await db.transactions
    .where('date')
    .between(monthStart.getTime(), monthEnd.getTime(), true, true)
    .filter(t => t.type === 'expense')
    .toArray();

  const spentBeforeTodayMinor = transactions
    .filter(t => t.date < todayStart.getTime())
    .reduce((sum, t) => sum + (Number(t.amountMinor) || 0), 0);

  const spentTodayMinor = transactions
    .filter(t => t.date >= todayStart.getTime() && t.date <= todayEnd.getTime())
    .reduce((sum, t) => sum + (Number(t.amountMinor) || 0), 0);

  // Fixed obligations are already reserved from income, so paid fixed
  // transactions must not be counted a second time.
  const fixedPaidThisMonthMinor = fixedExpenses.reduce((sum, fixed) => {
    const paid = fixed.lastPaidDate
      ? fixed.lastPaidDate >= monthStart.getTime() && fixed.lastPaidDate <= monthEnd.getTime()
      : false;
    return sum + (paid ? Number(fixed.amountMinor) || 0 : 0);
  }, 0);

  const discretionaryBudgetMinor = Math.max(0, incomeMinor - monthlyFixedMinor);
  const discretionarySpentBeforeTodayMinor = Math.max(
    0,
    spentBeforeTodayMinor - fixedPaidThisMonthMinor,
  );

  const remainingDiscretionaryMinor =
    discretionaryBudgetMinor - discretionarySpentBeforeTodayMinor;

  const totalDays = differenceInCalendarDays(monthEnd, monthStart) + 1;
  const daysRemainingIncludingToday =
    differenceInCalendarDays(monthEnd, todayStart) + 1;

  const safeToSpendMinor =
    daysRemainingIncludingToday > 0
      ? remainingDiscretionaryMinor / daysRemainingIncludingToday
      : remainingDiscretionaryMinor;

  // Today's transactions should be compared against today's allowance.
  // Do not subtract fixed payments twice because they are already reserved.
  const fixedPaidTodayMinor = fixedExpenses.reduce((sum, fixed) => {
    const paidToday =
      fixed.lastPaidDate != null &&
      fixed.lastPaidDate >= todayStart.getTime() &&
      fixed.lastPaidDate <= todayEnd.getTime();
    return sum + (paidToday ? Number(fixed.amountMinor) || 0 : 0);
  }, 0);

  const discretionarySpentTodayMinor = Math.max(0, spentTodayMinor - fixedPaidTodayMinor);
  const remainingTodayMinor = safeToSpendMinor - discretionarySpentTodayMinor;

  let status: DailyFinancialStatus['status'] = 'SAFE';
  if (remainingTodayMinor < 0) {
    status = 'DANGER';
  } else if (safeToSpendMinor > 0 && remainingTodayMinor < safeToSpendMinor * 0.2) {
    status = 'WARNING';
  }

  return {
    safeToSpend: Number((safeToSpendMinor / 100).toFixed(2)),
    spentToday: Number((discretionarySpentTodayMinor / 100).toFixed(2)),
    remainingToday: Number((remainingTodayMinor / 100).toFixed(2)),
    status,
  };
}
