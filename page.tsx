"use client";

import Link from "next/link";
import TransactionsList from "@/components/TransactionsList";
import BottomNav from "@/components/BottomNav"; // استدعاء الناف بار المودرن
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { translations } from "@/utils/i18n";
import { Settings } from "lucide-react"; // أيقونة مودرن

export default function HomePage() {
  const settings = useLiveQuery(() => db.settings.get('user_settings'));
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const fixedExpenses = useLiveQuery(() => db.fixedExpenses.toArray());

  const dialect = settings?.dialect || 'en';
  const currency = settings?.currency || 'SAR';
  const t = translations[dialect].dashboard;
  const isRTL = dialect === 'egyptian';

  const incomeMinor = settings?.monthlyIncomeMinor || 0;
  
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = now.getDate();
  const remainingDays = daysInMonth - currentDay + 1; 

  const currentMonthTransactions = transactions?.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
  }) || [];

  const todayTransactions = currentMonthTransactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate.getDate() === currentDay;
  });

  const totalFixedMinor = fixedExpenses?.reduce((sum, exp) => sum + exp.amountMinor, 0) || 0;
  const spentThisMonthMinor = currentMonthTransactions.reduce((sum, tx) => sum + tx.amountMinor, 0);
  const spentTodayMinor = todayTransactions.reduce((sum, tx) => sum + tx.amountMinor, 0);

  const availablePoolMinor = incomeMinor - totalFixedMinor; 
  const spentBeforeTodayMinor = spentThisMonthMinor - spentTodayMinor; 
  const budgetRemainingBeforeToday = availablePoolMinor - spentBeforeTodayMinor;
  
  const baseDailyBudgetMinor = remainingDays > 0 ? (budgetRemainingBeforeToday / remainingDays) : 0;
  const remainingTodayMinor = baseDailyBudgetMinor - spentTodayMinor; 

  const averageDailySpentMinor = currentDay > 0 ? (spentThisMonthMinor / currentDay) : 0;
  const projectedMonthlyMinor = averageDailySpentMinor * daysInMonth;

  let statusText = t.statusOnTrack;
  let statusColor = "text-green-600";
  let statusBg = "bg-green-50";

  if (projectedMonthlyMinor > availablePoolMinor) {
    statusText = t.statusDanger;
    statusColor = "text-red-600";
    statusBg = "bg-red-50";
  } else if (projectedMonthlyMinor > availablePoolMinor * 0.9) {
    statusText = t.statusWarning;
    statusColor = "text-yellow-600";
    statusBg = "bg-yellow-50";
  }

  const safeToSpendDisplay = (baseDailyBudgetMinor / 100).toFixed(2);
  const spentTodayDisplay = (spentTodayMinor / 100).toFixed(2);
  const remainingTodayDisplay = (remainingTodayMinor / 100).toFixed(2);
  const spentThisMonthDisplay = (spentThisMonthMinor / 100).toFixed(2);
  const projectedDisplay = (projectedMonthlyMinor / 100).toFixed(2);

  return (
    <div className="p-4 pt-safe pb-28 min-h-screen flex flex-col bg-gray-50 font-sans" dir={isRTL ? "rtl" : "ltr"}>
      <header className="py-2 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{t.subtitle}</p>
        </div>
        <Link href="/settings" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 active:scale-95 transition-transform text-gray-600">
          <Settings size={20} />
        </Link>
      </header>

      <div className={`mb-4 p-3 rounded-2xl flex items-center justify-center border ${statusBg} border-${statusColor.split('-')[1]}-100`}>
        <span className={`text-xs font-bold uppercase tracking-wider ${statusColor}`}>
          {statusText}
        </span>
      </div>

      <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6 relative overflow-hidden">
        <p className="text-gray-500 text-sm font-medium mb-1 relative z-10">{t.safeToSpend}</p>
        <div className="text-4xl font-bold text-gray-900 mb-6 flex items-baseline gap-2 relative z-10">
          {safeToSpendDisplay} <span className="text-xl text-gray-400 font-medium">{currency}</span>
        </div>
        
        <div className="flex justify-between items-center pt-4 border-t border-gray-100 mb-4 relative z-10">
          <div>
            <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">{t.spentToday}</p>
            <p className="font-bold text-gray-900">{spentTodayDisplay} {currency}</p>
          </div>
          <div className={isRTL ? "text-left" : "text-right"}>
            <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">{t.remainingToday}</p>
            <p className={`font-bold ${remainingTodayMinor < 0 ? 'text-red-500' : 'text-gray-900'}`}>
              {remainingTodayDisplay} {currency}
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-gray-50 bg-gray-50 -mx-6 -mb-6 p-4 rounded-b-3xl relative z-10">
          <div>
            <p className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider">{t.monthlySpending}</p>
            <p className="font-bold text-gray-700">{spentThisMonthDisplay} {currency}</p>
          </div>
          <div className={isRTL ? "text-left" : "text-right"}>
            <p className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider">{t.forecast}</p>
            <p className="font-bold text-gray-700">{projectedDisplay} {currency}</p>
          </div>
        </div>
      </section>
<section className="mt-6">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xl font-bold text-gray-900">{t.recentActivity}</h2>
          <Link href="/transactions" className="text-sm font-medium text-blue-600 active:opacity-50">
            {t.seeAll}
          </Link>
        </div>
        <TransactionsList />
      </section>

    </div>
  );
}
