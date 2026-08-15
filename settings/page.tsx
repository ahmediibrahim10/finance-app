"use client";

import { useState, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import Link from "next/link";
import { translations } from "@/utils/i18n";

export default function Settings() {
  const settings = useLiveQuery(() => db.settings.get('user_settings'));
  const [income, setIncome] = useState("");
  const [dialect, setDialect] = useState<'en' | 'egyptian'>('en');
  const [currency, setCurrency] = useState<'SAR' | 'EGP'>('SAR');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      if (settings.monthlyIncomeMinor) {
        setIncome((settings.monthlyIncomeMinor / 100).toString());
      }
      if (settings.dialect) setDialect(settings.dialect);
      if (settings.currency) setCurrency(settings.currency);
    }
  }, [settings]);

  const t = translations[dialect].settings;
  const isRTL = dialect === 'egyptian';

  const handleSaveSettings = async () => {
    const incomeMinor = Math.round(Number(income) * 100);
    await db.settings.put({
      id: 'user_settings',
      monthlyIncomeMinor: incomeMinor,
      dialect: dialect,
      currency: currency,
    } as any);
    
    alert(t.alerts.saved);
  };

  const handleExport = async () => {
    try {
      const data = {
        transactions: await db.transactions.toArray(),
        categories: await db.categories.toArray(),
        settings: await db.settings.toArray(),
        fixedExpenses: await db.fixedExpenses.toArray(),
      };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(t.alerts.exportError);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(t.alerts.importWarning)) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        await db.transaction('rw', db.transactions, db.categories, db.settings, db.fixedExpenses, async () => {
          if (data.transactions) { await db.transactions.clear(); await db.transactions.bulkAdd(data.transactions); }
          if (data.categories) { await db.categories.clear(); await db.categories.bulkAdd(data.categories); }
          if (data.settings) { await db.settings.clear(); await db.settings.bulkAdd(data.settings); }
          if (data.fixedExpenses) { await db.fixedExpenses.clear(); await db.fixedExpenses.bulkAdd(data.fixedExpenses); }
        });
        alert(t.alerts.importSuccess);
        window.location.reload(); 
      } catch (error) {
        alert(t.alerts.importError);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 pt-safe pb-24 space-y-6 bg-gray-50 min-h-screen font-sans" dir={isRTL ? "rtl" : "ltr"}>
      <header className="py-2 flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <Link href="/" className="text-sm text-blue-600 font-medium">{t.home}</Link>
      </header>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 mb-2 px-2 tracking-wider uppercase">{t.financialSetup}</h2>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          
          <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <span className="font-medium text-gray-700">{t.monthlyIncome}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                className={`font-bold w-24 outline-none bg-transparent text-black ${isRTL ? "text-left" : "text-right"}`}
                placeholder="0"
                dir="ltr"
              />
              <span className="text-gray-400">{currency}</span>
            </div>
          </div>

          <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <span className="font-medium text-gray-700">{t.currency}</span>
            <select 
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'SAR' | 'EGP')}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
            >
              <option value="SAR">SAR (ريال سعودي)</option>
              <option value="EGP">EGP (جنيه مصري)</option>
            </select>
          </div>

          <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <span className="font-medium text-gray-700">{t.language}</span>
            <select 
              value={dialect}
              onChange={(e) => setDialect(e.target.value as 'en' | 'egyptian')}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
            >
              <option value="en">English 🇺🇸</option>
              <option value="egyptian">المصرية 🇪🇬</option>
            </select>
          </div>

          <button 
            onClick={handleSaveSettings}
            className="w-full p-4 text-blue-600 font-semibold active:bg-gray-50 transition-colors border-b border-gray-100 text-center"
          >
            {t.saveSettings}
          </button>
          
          <Link href="/fixed-expenses" className="w-full p-4 flex items-center justify-between active:bg-gray-50 transition-colors">
            <span className="font-medium text-gray-700">{t.manageFixed}</span>
            <span className={`text-gray-400 transform ${isRTL ? 'rotate-180' : ''}`}>➔</span>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 mb-2 px-2 tracking-wider uppercase">{t.dataManagement}</h2>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <button 
            onClick={handleExport}
            className="w-full p-4 flex items-center justify-between border-b border-gray-100 active:bg-gray-50 transition-colors"
          >
            <span className="font-medium text-gray-700">{t.export}</span>
            <span className="text-xl">📤</span>
          </button>

          <div className="relative">
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImport}
              ref={fileInputRef}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="w-full p-4 flex items-center justify-between active:bg-gray-50 transition-colors">
              <span className="font-medium text-gray-700">{t.import}</span>
              <span className="text-xl">📥</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-red-500 mb-2 px-2 uppercase tracking-wider">{t.dangerZone}</h2>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-red-100">
          <button 
            onClick={async () => {
              if(confirm(t.alerts.clearWarning)) {
                await db.transactions.clear();
                window.location.href = "/";
              }
            }}
            className="w-full p-4 text-red-600 font-bold active:bg-red-50 transition-colors"
          >
            {t.clearOld}
          </button>
        </div>
      </section>
    </div>
  );
}