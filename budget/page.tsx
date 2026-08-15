"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { useMemo } from "react";
import { translations } from "@/utils/i18n";
import BottomNav from "@/components/BottomNav";
import { AlertCircle, TrendingUp } from "lucide-react";

export default function AnalyticsPhase4() {
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const settings = useLiveQuery(() => db.settings.get('user_settings'));

  const dialect = settings?.dialect || 'en';
  const currency = settings?.currency || 'SAR';
  const t = translations[dialect].analytics;
  const isRTL = dialect === 'egyptian';

  const incomeMinor = settings?.monthlyIncomeMinor || 0;

  const data = useMemo(() => {
    if (!transactions || !categories) return null;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfDay - (now.getDay() * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate() || 1;

    let todayTotal = 0, weekTotal = 0, monthTotal = 0;
    let todayCount = 0, weekCount = 0, monthCount = 0;

    const categoryTotals: Record<string, number> = {};
    const merchantTotals: Record<string, { total: number; count: number }> = {};

    transactions.forEach(tx => {
      if (tx.date >= startOfMonth) {
        monthTotal += tx.amountMinor;
        monthCount++;
        
        const catId = tx.categoryId || 'default';
        categoryTotals[catId] = (categoryTotals[catId] || 0) + tx.amountMinor;
        
        const merchName = tx.merchant.toLowerCase().trim();
        if (!merchantTotals[merchName]) merchantTotals[merchName] = { total: 0, count: 0 };
        merchantTotals[merchName].total += tx.amountMinor;
        merchantTotals[merchName].count++;
      }
      if (tx.date >= startOfWeek) {
        weekTotal += tx.amountMinor;
        weekCount++;
      }
      if (tx.date >= startOfDay) {
        todayTotal += tx.amountMinor;
        todayCount++;
      }
    });

    const categoryStats = Object.keys(categoryTotals).map(catId => {
      const category = categories.find(c => c.id === catId);
      const percentage = monthTotal > 0 ? (categoryTotals[catId] / monthTotal) * 100 : 0;
      return { id: catId, name: category?.name || 'Other', icon: category?.icon || '📦', amountMinor: categoryTotals[catId], percentage };
    }).sort((a, b) => b.amountMinor - a.amountMinor);

    const topMerchants = Object.entries(merchantTotals)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    const dailyAvg = currentDay > 0 ? (monthTotal / currentDay) : 0;
    const projectedTotal = dailyAvg * daysInMonth;

    const insights: string[] = [];
    if (categoryStats.length > 0 && categoryStats[0].percentage > 30) {
      insights.push(t.insightCategory(Math.round(categoryStats[0].percentage), categoryStats[0].name));
    }
    if (todayTotal > dailyAvg) {
      insights.push(dialect === 'egyptian' ? "صرفت النهارده أكتر من متوسط يومك الطبيعي." : "You spent more today than your daily average.");
    }
    if (topMerchants.length > 0) {
      insights.push(dialect === 'egyptian' ? `أكتر مكان بتصرف فيه هو ${topMerchants[0].name}.` : `Most of your money goes to ${topMerchants[0].name}.`);
    }

    return {
      today: { total: todayTotal, count: todayCount },
      week: { total: weekTotal, count: weekCount },
      month: { total: monthTotal, count: monthCount },
      dailyAvg,
      projectedTotal,
      categoryStats,
      topMerchants,
      insights,
      daysRemaining: daysInMonth - currentDay
    };
  }, [transactions, categories, t, dialect]);

  if (!data) return <div className="p-4 pt-safe text-center">Loading...</div>;

  let forecastStatus = "SAFE";
  let forecastColor = "text-green-600 bg-green-50";
  if (incomeMinor > 0) {
    if (data.projectedTotal > incomeMinor) {
      forecastStatus = "DANGER";
      forecastColor = "text-red-600 bg-red-50";
    } else if (data.projectedTotal > incomeMinor * 0.8) {
      forecastStatus = "WARNING";
      forecastColor = "text-yellow-600 bg-yellow-50";
    }
  }

  return (
    <div className="p-4 pt-safe pb-28 min-h-screen bg-gray-50 font-sans" dir={isRTL ? "rtl" : "ltr"}>
      <header className="py-2 mb-4">
        <h1 className="text-3xl font-bold text-gray-900">{t.title}</h1>
        <p className="text-gray-500 text-sm mt-1">{t.subtitle}</p>
      </header>

      {/* Forecast */}
      <div className={`p-5 rounded-3xl shadow-sm mb-6 ${forecastColor}`}>
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs font-bold uppercase tracking-wider">{t.forecast}</p>
          <span className="text-xs font-bold px-2 py-1 bg-white/50 rounded-lg">{forecastStatus}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold">{(data.projectedTotal / 100).toFixed(2)}</p>
          <span className="text-sm font-medium">{currency}</span>
        </div>
        <p className="text-xs mt-2 opacity-80">
          {dialect === 'egyptian' ? `مبني على الأيام الـ ${data.daysRemaining} المتبقية في الشهر.` : `Based on your ${data.daysRemaining} remaining days.`}
        </p>
      </div>

      {/* Summary */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">
          {dialect === 'egyptian' ? 'الملخص' : 'Summary'}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">{dialect === 'egyptian' ? 'النهارده' : 'Today'}</p>
            <p className="text-lg font-bold">{(data.today.total / 100).toFixed(0)}</p>
            <p className="text-[10px] text-gray-400">{data.today.count} {dialect === 'egyptian' ? 'عمليات' : 'txns'}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">{dialect === 'egyptian' ? 'الأسبوع' : 'Week'}</p>
            <p className="text-lg font-bold">{(data.week.total / 100).toFixed(0)}</p>
            <p className="text-[10px] text-gray-400">{data.week.count} {dialect === 'egyptian' ? 'عمليات' : 'txns'}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">{dialect === 'egyptian' ? 'الشهر' : 'Month'}</p>
            <p className="text-lg font-bold">{(data.month.total / 100).toFixed(0)}</p>
            <p className="text-[10px] text-gray-400">{data.month.count} {dialect === 'egyptian' ? 'عمليات' : 'txns'}</p>
          </div>
        </div>
      </section>

      {/* Smart Insights */}
      {data.insights.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">{t.smartInsights}</h2>
          <div className="space-y-2">
            {data.insights.map((insight, idx) => (
              <div key={idx} className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
                <AlertCircle size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-900 font-medium">{insight}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Merchants */}
      {data.topMerchants.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">
            {dialect === 'egyptian' ? 'أكتر الأماكن صرفاً' : 'Top Merchants'}
          </h2>
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 space-y-4">
            {data.topMerchants.map((merchant, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900 capitalize">{merchant.name}</p>
                  <p className="text-xs text-gray-400">{merchant.count} {dialect === 'egyptian' ? 'عمليات شراء' : 'transactions'}</p>
                </div>
                <p className="font-bold text-gray-900">{(merchant.total / 100).toFixed(0)} <span className="text-xs font-normal text-gray-500">{currency}</span></p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Category Breakdown */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">{t.spendingByCategory}</h2>
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 space-y-5">
          {data.categoryStats.length === 0 ? (
            <p className="text-center text-gray-400 text-sm">{t.noExpenses}</p>
          ) : (
            data.categoryStats.map(cat => (
              <div key={cat.id}>
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.icon}</span>
                    <span className="font-medium text-gray-900">{cat.name}</span>
                  </div>
                  <div className={isRTL ? "text-left" : "text-right"}>
                    <span className="font-bold text-gray-900">{(cat.amountMinor / 100).toFixed(0)}</span>
                    <span className="text-xs text-gray-400 mx-2">{Math.round(cat.percentage)}%</span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-800 rounded-full" style={{ width: `${cat.percentage}%` }}></div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <BottomNav />
    </div>
  );
}