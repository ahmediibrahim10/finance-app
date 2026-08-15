"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { format } from "date-fns";
import Link from "next/link";
import { formatMinorUnits } from "@/utils/currency";

export default function Transactions() {
  const transactions = useLiveQuery(() =>
    db.transactions.orderBy('date').reverse().toArray()
  );
  const categories = useLiveQuery(() => db.categories.toArray());
  const settings = useLiveQuery(() => db.settings.get('user_settings'));
  const isRTL = (settings?.dialect || 'en') === 'egyptian';
  const defaultCurrency = settings?.currency || 'SAR';

  const getCategory = (id: string) => categories?.find(c => c.id === id);

  if (!transactions || !categories) return <div className="p-4 pt-safe text-center">Loading...</div>;

  return (
    <div className="p-4 pt-safe pb-28" dir={isRTL ? "rtl" : "ltr"}>
      <header className="py-4 mb-2">
        <h1 className="text-2xl font-bold">Transactions</h1>
      </header>

      {transactions.length === 0 ? (
        <div className="text-center text-gray-400 mt-10">
          No transactions yet.
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((t) => {
            const category = getCategory(t.categoryId);

            return (
              <Link href={`/edit?id=${t.id}`} key={t.id} className="block active:scale-[0.98] transition-transform">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: `${category?.color}20` }}>
                      {category?.icon || '📦'}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{t.merchant}</h3>
                      <p className="text-xs text-gray-500">{format(t.date, 'MMM d, h:mm a')} • {category?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-900">{formatMinorUnits(t.amountMinor)} {t.currency || defaultCurrency}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}