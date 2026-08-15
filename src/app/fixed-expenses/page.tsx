"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toMinorUnits, formatMinorUnits } from "@/utils/currency";

export default function FixedExpenses() {
  const fixedExpenses = useLiveQuery(() => db.fixedExpenses.toArray());
  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray());
  const settings = useLiveQuery(() => db.settings.get('user_settings'));
  const currency = settings?.currency || 'SAR';

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [categoryId, setCategoryId] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || !categoryId || !dayOfMonth) return;

    // كان بيخزن amount عادي (ريال كامل) بينما باقي التطبيق بيتوقع amountMinor (هللات)
    // وده كان بيكسر حساب "المبلغ الآمن للصرف" لأنه بيرجع NaN - اتصلحت
    await db.fixedExpenses.add({
      id: crypto.randomUUID(),
      name,
      amountMinor: toMinorUnits(amount),
      dayOfMonth: Number(dayOfMonth),
      categoryId,
    });

    setName("");
    setAmount("");
    setDayOfMonth("1");
    setCategoryId("");
  };

  const handleDelete = async (id: string) => {
    const confirmDelete = confirm("Are you sure you want to delete this expense?");
    if (confirmDelete) {
      await db.fixedExpenses.delete(id);
    }
  };

  const getCategory = (id: string) => categories?.find(c => c.id === id);

  return (
    <div className="p-4 pt-safe pb-28 min-h-screen flex flex-col">
      <header className="py-2 mb-4 flex items-center gap-3">
        <Link href="/settings" className="p-2 -ml-2 bg-white rounded-full shadow-sm active:scale-95">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Fixed Expenses</h1>
          <p className="text-gray-500 text-sm">Rent, Bills & Subscriptions</p>
        </div>
      </header>

      <form onSubmit={handleAdd} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Add New Obligation</h2>

        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 bg-gray-50 rounded-xl outline-none"
          placeholder="Expense Name (e.g. Rent)"
        />

        <div className="flex gap-3">
          <div className="flex-1 flex items-center bg-gray-50 rounded-xl px-3">
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full py-3 bg-transparent outline-none"
              placeholder="Amount"
            />
            <span className="text-gray-400 text-sm font-medium">{currency}</span>
          </div>
          <div className="w-24 relative bg-gray-50 rounded-xl">
            <select
              required
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className="w-full p-3 bg-transparent outline-none appearance-none text-center"
            >
              <option value="" disabled>Day</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative bg-gray-50 rounded-xl">
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full p-3 bg-transparent outline-none appearance-none"
          >
            <option value="" disabled>Select Category</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="w-full bg-black text-white p-3 rounded-xl font-bold active:scale-95 transition-transform">
          Add Expense
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="font-semibold text-gray-900 px-1">Your Monthly Obligations</h2>

        {!fixedExpenses || fixedExpenses.length === 0 ? (
          <div className="text-center text-gray-400 py-8 bg-white rounded-3xl border border-gray-100">
            No fixed expenses added yet.
          </div>
        ) : (
          fixedExpenses.map((expense) => {
            const category = getCategory(expense.categoryId);
            return (
              <div key={expense.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-2xl w-10 h-10 flex items-center justify-center rounded-full" style={{ backgroundColor: `${category?.color}20` }}>
                    {category?.icon || '🔄'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{expense.name}</h3>
                    <p className="text-xs text-gray-500">Day {expense.dayOfMonth} • {category?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-gray-900">{formatMinorUnits(expense.amountMinor)} {currency}</span>
                  <button onClick={() => handleDelete(expense.id)} className="text-red-400 p-2 active:scale-95">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}