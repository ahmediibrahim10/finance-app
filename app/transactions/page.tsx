"use client";

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { format } from 'date-fns';
import Link from 'next/link';
import { formatMinorUnits } from '@/utils/currency';

export default function Transactions() {
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const settings = useLiveQuery(() => db.settings.get('user_settings'));
  const isRTL = (settings?.dialect || 'en') === 'egyptian';
  const currency = settings?.currency || 'SAR';

  if (!transactions || !categories) return <div className="p-4 pt-safe text-center">Loading...</div>;

  return (
    <div className="p-4 pt-safe pb-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="py-4 mb-2"><h1 className="text-2xl font-bold">Transactions</h1></header>
      {!transactions.length ? <div className="text-center text-gray-400 mt-10">No transactions yet.</div> : (
        <div className="space-y-3">
          {transactions.map(transaction => {
            const category = categories.find(c => c.id === transaction.categoryId);
            return <Link href={`/edit?id=${transaction.id}`} key={transaction.id} className="block active:scale-[0.98] transition-transform">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: `${category?.color || '#999'}20` }}>{category?.icon || '📦'}</div>
                  <div className="min-w-0"><h3 className="font-bold text-gray-900 truncate">{transaction.merchant}</h3><p className="text-xs text-gray-500 truncate">{format(transaction.date, 'MMM d, h:mm a')} • {category?.name || 'Other'}</p></div>
                </div>
                <span className="font-bold text-gray-900 whitespace-nowrap">{formatMinorUnits(transaction.amountMinor)} {transaction.currency || currency}</span>
              </div>
            </Link>;
          })}
        </div>
      )}
    </div>
  );
}
