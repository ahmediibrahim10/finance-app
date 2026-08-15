export interface Transaction {
  id: string;
  amountMinor: number; 
  currency: string;
  merchant: string;
  categoryId: string;
  date: number; 
  source: 'manual' | 'sms';
  type: 'expense'; 
  note?: string;
  fingerprint?: string; 
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense';
  isDefault?: boolean;
}

export interface FixedExpense {
  id: string;
  name: string;
  amountMinor: number; 
  dayOfMonth: number;
  categoryId: string;
  lastPaidDate?: number;
}

export interface Settings {
  id: string;
  monthlyIncomeMinor: number; 
  dialect?: 'en' | 'egyptian';
  currency?: 'SAR' | 'EGP';
  budgetPeriodStartDay?: number;
  theme?: string;
}