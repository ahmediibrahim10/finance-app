import { db } from "@/db";
import { Transaction } from "@/types/models";
import { toMinorUnits } from "@/utils/currency";

export async function addExpense(
  amount: string | number,
  merchant: string,
  categoryId: string,
  source: "manual" | "sms" = "manual",
  note = "",
  referenceId?: string
): Promise<Transaction | null> {
  const cleanMerchant = merchant.trim();
  const amountMinor = toMinorUnits(amount);
  const now = Date.now();

  if (!cleanMerchant || amountMinor <= 0 || !Number.isFinite(amountMinor)) {
    throw new Error("بيانات المصروف غير صالحة.");
  }

  if (source === "sms" && referenceId) {
    const existing = await db.transactions
      .where("fingerprint")
      .equals(referenceId)
      .first();

    if (existing) {
      return null;
    }
  }

  if (source === "sms" && !referenceId) {
    const oneHourAgo = now - 60 * 60 * 1000;
    const recent = await db.transactions
      .where("date")
      .above(oneHourAgo)
      .toArray();

    const duplicate = recent.some(
      (tx) =>
        tx.merchant.toLowerCase() === cleanMerchant.toLowerCase() &&
        tx.amountMinor === amountMinor &&
        tx.source === "sms"
    );

    if (duplicate) return null;
  }

  const fingerprint =
    referenceId ||
    `${source}:${cleanMerchant.toLowerCase()}:${amountMinor}:${now}`;

  const newTransaction: Transaction = {
    id: crypto.randomUUID(),
    amountMinor,
    currency: "SAR",
    merchant: cleanMerchant,
    categoryId,
    date: now,
    source,
    type: "expense",
    note,
    fingerprint,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction(
    "rw",
    db.transactions,
    db.fixedExpenses,
    async () => {
      await db.transactions.add(newTransaction);

      const fixedExpenses = await db.fixedExpenses.toArray();
      const matchingFixed = fixedExpenses.find(
        (expense) =>
          expense.amountMinor === amountMinor ||
          expense.name.toLowerCase().includes(cleanMerchant.toLowerCase())
      );

      if (matchingFixed) {
        await db.fixedExpenses.update(matchingFixed.id, {
          lastPaidDate: now,
        });
      }
    }
  );

  return newTransaction;
}

export async function updateExpense(
  id: string,
  amount: string | number,
  merchant: string,
  categoryId: string,
  note = ""
): Promise<void> {
  const amountMinor = toMinorUnits(amount);
  const cleanMerchant = merchant.trim();

  if (!id || !cleanMerchant || amountMinor <= 0) {
    throw new Error("بيانات التعديل غير صالحة.");
  }

  await db.transactions.update(id, {
    amountMinor,
    merchant: cleanMerchant,
    categoryId,
    note,
    updatedAt: Date.now(),
  });
}

export async function deleteExpense(id: string): Promise<void> {
  if (!id) throw new Error("معرف المصروف غير صالح.");
  await db.transactions.delete(id);
}
