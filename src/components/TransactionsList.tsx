"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import Link from "next/link";

export default function TransactionsList() {
  const transactions = useLiveQuery(() => 
    db.transactions.orderBy('date').reverse().toArray()
  );

  if (!transactions) return <div className="p-4 text-center text-gray-400">Loading...</div>;
  if (transactions.length === 0) return <div className="p-4 text-center text-gray-400 border border-gray-300">No transactions today.</div>;

  return (
    <div className="space-y-3">
      {transactions.map((tx) => {
        const txDate = new Date(tx.date);
        const timeString = new Intl.DateTimeFormat('en-SA', { hour: 'numeric', minute: 'numeric', hour12: true }).format(txDate);
        const dateString = new Intl.DateTimeFormat('en-SA', { month: 'short', day: 'numeric' }).format(txDate);

        return (
          // تم تغيير الرابط هنا ليستخدم Query Parameter
          <Link href={`/edit?id=${tx.id}`} key={tx.id} className="block active:scale-[0.98] transition-transform">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-bold text-gray-900">{tx.merchant}</span>
                <span className="text-xs text-gray-500">
                  {dateString} • {timeString} 
                  {tx.source === 'sms' && ' ⚡'}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-bold text-gray-900">
                  {(tx.amountMinor / 100).toFixed(2)} {tx.currency}
                </span>
                <span className="text-[10px] text-gray-400 uppercase">{tx.source}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}