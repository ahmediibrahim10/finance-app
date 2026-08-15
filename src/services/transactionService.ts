import { db } from '@/db';
import { Transaction } from '@/types/models';
import { toMinorUnits } from '@/utils/currency';

export interface AddExpenseInput {
  amount: string | number;
  merchant: string;
  categoryId: string;
  source?: 'manual' | 'sms';
  note?: string;
  referenceId?: string;
}

function normalizeMerchant(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function makeFingerprint(
  merchant: string,
  amountMinor: number,
  source: 'manual' | 'sms',
  referenceId?: string,
): string {
  return referenceId || `${source}:${merchant.toLowerCase()}:${amountMinor}:${Date.now()}`;
}

export async function addExpense(input: AddExpenseInput): Promise<Transaction | null>;
export async function addExpense(
  amount: string | number,
  merchant: string,
  categoryId: string,
  source?: 'manual' | 'sms',
  note?: string,
  referenceId?: string,
): Promise<Transaction | null>;
export async function addExpense(
  inputOrAmount: AddExpenseInput | string | number,
  merchantArg?: string,
  categoryIdArg?: string,
  sourceArg: 'manual' | 'sms' = 'manual',
  noteArg = '',
  referenceIdArg?: string,
): Promise<Transaction | null> {
  const input: AddExpenseInput =
    typeof inputOrAmount === 'object'
      ? inputOrAmount
      : {
          amount: inputOrAmount,
          merchant: merchantArg ?? '',
          categoryId: categoryIdArg ?? '',
          source: sourceArg,
          note: noteArg,
          referenceId: referenceIdArg,
        };

  const merchant = normalizeMerchant(input.merchant);
  const amountMinor = toMinorUnits(input.amount);
  const source = input.source ?? 'manual';

  if (!merchant || !input.categoryId || !Number.isFinite(amountMinor) || amountMinor <= 0) {
    throw new Error('Invalid expense data.');
  }

  if (source === 'sms') {
    if (input.referenceId) {
      const existing = await db.transactions
        .where('fingerprint')
        .equals(input.referenceId)
        .first();

      if (existing) return null;
    } else {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recent = await db.transactions.where('date').above(oneHourAgo).toArray();
      const duplicate = recent.some(
        tx =>
          tx.source === 'sms' &&
          tx.amountMinor === amountMinor &&
          normalizeMerchant(tx.merchant).toLowerCase() === merchant.toLowerCase(),
      );

      if (duplicate) return null;
    }
  }

  const now = Date.now();
  const transaction: Transaction = {
    id: crypto.randomUUID(),
    amountMinor,
    currency: (await db.settings.get('user_settings'))?.currency || 'SAR',
    merchant,
    categoryId: input.categoryId,
    date: now,
    source,
    type: 'expense',
    note: input.note?.trim() || '',
    fingerprint: makeFingerprint(merchant, amountMinor, source, input.referenceId),
    createdAt: now,
    updatedAt: now,
  };

  await db.transactions.add(transaction);
  return transaction;
}

export async function updateExpense(
  id: string,
  amount: string | number,
  merchant: string,
  categoryId: string,
  note = '',
): Promise<void> {
  const amountMinor = toMinorUnits(amount);
  const normalizedMerchant = normalizeMerchant(merchant);

  if (!id || !normalizedMerchant || !categoryId || !Number.isFinite(amountMinor) || amountMinor <= 0) {
    throw new Error('Invalid expense data.');
  }

  await db.transactions.update(id, {
    amountMinor,
    merchant: normalizedMerchant,
    categoryId,
    note: note.trim(),
    updatedAt: Date.now(),
  });
}

export async function deleteExpense(id: string): Promise<void> {
  if (!id) throw new Error('Transaction id is required.');
  await db.transactions.delete(id);
}
