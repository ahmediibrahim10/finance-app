import { db } from "@/db";
import { Transaction } from "@/types/models";
import { toMinorUnits } from "@/utils/currency";

function normalizeMerchant(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function validateAmount(amount: string | number): number {
  const numeric = Number(amount);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("المبلغ غير صالح.");
  }

  const amountMinor = toMinorUnits(numeric);

  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("المبلغ غير صالح.");
  }

  return amountMinor;
}

export async function addExpense(
  amount: string | number,
  merchant: string,
  categoryId: string,
  source: "manual" | "sms" = "manual",
  note: string = "",
  referenceId?: string
): Promise<Transaction | null> {
  const amountMinor = validateAmount(amount);
  const cleanMerchant = normalizeMerchant(merchant);

  if (!cleanMerchant) {
    throw new Error("اسم التاجر مطلوب.");
  }

  const now = Date.now();

  if (source === "sms" && !referenceId) {
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentTransactions = await db.transactions
      .where("date")
      .above(oneHourAgo)
      .toArray();

    const duplicate = recentTransactions.some(
      (tx) =>
        tx.source === "sms" &&
        tx.amountMinor === amountMinor &&
        normalizeMerchant(tx.merchant).toLowerCase() ===
          cleanMerchant.toLowerCase()
    );

    if (duplicate) {
      console.warn("Duplicate SMS transaction prevented.");
      return null;
    }
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
    note: note.trim(),
    fingerprint,
    createdAt: now,
    updatedAt: now,
  };

  await db.transactions.add(newTransaction);

  return newTransaction;
}

export async function updateExpense(
  id: string,
  amount: string | number,
  merchant: string,
  categoryId: string,
  note: string = ""
): Promise<void> {
  const amountMinor = validateAmount(amount);
  const cleanMerchant = normalizeMerchant(merchant);

  if (!cleanMerchant) {
    throw new Error("اسم التاجر مطلوب.");
  }

  const existing = await db.transactions.get(id);

  if (!existing) {
    throw new Error("المعاملة غير موجودة.");
  }

  await db.transactions.update(id, {
    amountMinor,
    merchant: cleanMerchant,
    categoryId,
    note: note.trim(),
    updatedAt: Date.now(),
  });
}

export async function deleteExpense(id: string): Promise<void> {
  const existing = await db.transactions.get(id);

  if (!existing) {
    throw new Error("المعاملة غير موجودة.");
  }

  await db.transactions.delete(id);
}
