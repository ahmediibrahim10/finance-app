"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { updateExpense, deleteExpense } from "@/services/transactionService";
import { ArrowLeft, Trash2 } from "lucide-react";

function EditExpenseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const transactionId = searchParams.get("id");

  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray());
  const transaction = useLiveQuery(() =>
    transactionId ? db.transactions.get(transactionId) : undefined
  , [transactionId]);

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (transaction) {
      setAmount((transaction.amountMinor / 100).toString());
      setMerchant(transaction.merchant);
      setCategoryId(transaction.categoryId);
      setNote(transaction.note || "");
    }
  }, [transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !merchant || !categoryId || !transactionId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // كانت بتتنادى بباراميترات منفصلة قبل كده - اتصلحت لتطابق توقيع الدالة الجديد
      await updateExpense(transactionId, Number(amount), merchant, categoryId, note);
      router.push("/");
    } catch (error) {
      console.error("Error updating expense:", error);
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!transactionId) return;
    const confirmDelete = window.confirm("هل أنت متأكد من حذف هذا المصروف؟ سيتم إرجاع المبلغ لميزانيتك.");
    if (confirmDelete) {
      await deleteExpense(transactionId);
      router.push("/");
    }
  };

  if (!transactionId) return <div className="p-4 pt-safe text-center">Invalid Transaction ID</div>;
  if (!transaction) return <div className="p-4 pt-safe text-center text-gray-500">Loading transaction details...</div>;

  return (
    // ضفنا pb-28 هنا لأن زرار "Update Transaction" كان بيختفي وراء الـ BottomNav الثابت
    <div className="p-4 pt-safe pb-28 min-h-screen flex flex-col bg-gray-50">
      <header className="py-2 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="p-2 -ml-2 bg-white rounded-full shadow-sm active:scale-95">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">Edit Expense</h1>
        </div>
        <button onClick={handleDelete} className="p-2 bg-red-50 text-red-600 rounded-full active:scale-95">
          <Trash2 size={20} />
        </button>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-3">
          <span className="text-gray-400 font-medium">SAR</span>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 text-3xl font-bold bg-transparent outline-none w-full text-black"
          />
        </div>

        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
          <input
            type="text"
            required
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            className="w-full text-lg font-medium bg-transparent outline-none"
            placeholder="Merchant Name"
          />
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative">
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full p-4 text-lg font-medium bg-transparent outline-none appearance-none"
          >
            <option value="" disabled>Select Category</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▼</div>
        </div>

        <div className="flex-1"></div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-black text-white p-4 rounded-2xl font-bold text-lg active:scale-95 transition-transform disabled:opacity-50 mb-4"
        >
          {isSubmitting ? "Saving..." : "Update Transaction"}
        </button>
      </form>
    </div>
  );
}

export default function EditExpensePage() {
  return (
    <Suspense fallback={<div className="p-4 pt-safe text-center">Loading module...</div>}>
      <EditExpenseForm />
    </Suspense>
  );
}