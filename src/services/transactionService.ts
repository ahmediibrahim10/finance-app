import { db } from '@/db';
import { Transaction } from '@/types/models';
import { toMinorUnits } from '@/utils/currency';

export async function addExpense(
  amount: string | number,
  merchant: string,
  categoryId: string,
  source: 'manual' | 'sms' = 'manual',
  note: string = '',
  referenceId?: string
): Promise<Transaction | null> {
  
  const amountMinor = toMinorUnits(amount);
  const now = Date.now();

  if (source === 'sms' && !referenceId) {
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentDuplicate = await db.transactions
      .where('date')
      .above(oneHourAgo)
      .toArray();
      
    const isDuplicate = recentDuplicate.some(tx => 
      tx.merchant.toLowerCase() === merchant.toLowerCase().trim() &&
      tx.amountMinor === amountMinor &&
      tx.source === 'sms'
    );
    
    if (isDuplicate) {
      console.warn('Duplicate SMS transaction prevented.');
      return null;
    }
  }

  const fingerprint = referenceId || `${merchant.trim()}-${amountMinor}-${now}-${source}`;

  const newTransaction: Transaction = {
    id: crypto.randomUUID(),
    amountMinor,
    currency: 'SAR',
    merchant: merchant.trim(),
    categoryId,
    date: now,
    source,
    type: 'expense',
    note,
    fingerprint,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', db.transactions, db.fixedExpenses, async () => {
    await db.transactions.add(newTransaction);
    
    const upcomingExpenses = await db.fixedExpenses.toArray();
    const matchingFixed = upcomingExpenses.find(exp => 
       exp.amountMinor === amountMinor || exp.name.toLowerCase().includes(merchant.toLowerCase().trim())
    );
    
    if (matchingFixed) {
      await db.fixedExpenses.update(matchingFixed.id, { lastPaidDate: now } as any);
    }
  });

  return newTransaction;
}

// دالة تحديث المصروف (تم إضافتها وحل المشكلة)
export async function updateExpense(
  id: string,
  amount: string | number,
  merchant: string,
  categoryId: string,
  note: string = ''
): Promise<void> {
  const amountMinor = toMinorUnits(amount);
  
  await db.transactions.update(id, {
    amountMinor,
    merchant: merchant.trim(),
    categoryId,
    note,
    updatedAt: Date.now(),
  });
}

// دالة حذف المصروف (تم إضافتها وحل المشكلة)
export async function deleteExpense(id: string): Promise<void> {
  await db.transactions.delete(id);
}