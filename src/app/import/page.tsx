"use client";

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addExpense } from '@/services/transactionService';
import { db } from '@/db';

function ImportHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasProcessed = useRef(false);
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processImport = async () => {
      try {
        const rawAmount = searchParams.get('amount');
        const merchant = (searchParams.get('merchant') || '').trim().replace(/[<>]/g, '');
        const referenceId = searchParams.get('referenceId') || undefined;

        if (!rawAmount || !merchant) throw new Error('Missing required fields.');

        const amount = Number(rawAmount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid transaction amount.');

        const categories = await db.categories.where('type').equals('expense').toArray();
        if (!categories.length) throw new Error('No expense categories available.');

        const lower = merchant.toLowerCase();
        const target =
          categories.find(c => (lower.includes('starbucks') || lower.includes('coffee') || lower.includes('قهوة')) && c.name.toLowerCase() === 'coffee') ||
          categories.find(c => (lower.includes('uber') || lower.includes('careem')) && c.name.toLowerCase() === 'transport') ||
          categories.find(c => c.name.toLowerCase() === 'other') ||
          categories[0];

        const result = await addExpense({
          amount,
          merchant,
          categoryId: target.id,
          source: 'sms',
          note: 'Automated via SMS',
          referenceId,
        });

        if (!result) {
          setStatus('success');
          setTimeout(() => router.replace('/'), 1200);
          return;
        }

        setStatus('success');
        setTimeout(() => router.replace('/'), 1200);
      } catch (error) {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : "Couldn't import transaction.");
      }
    };

    processImport();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 max-w-sm w-full text-center space-y-4">
        {status === 'processing' && <><div className="text-4xl animate-bounce">⚡</div><h1 className="font-bold text-lg">Importing transaction...</h1></>}
        {status === 'success' && <><div className="text-4xl">✅</div><h1 className="font-bold text-lg">Transaction added!</h1><p className="text-xs text-gray-500">Redirecting...</p></>}
        {status === 'error' && <><div className="text-4xl">❌</div><h1 className="font-bold text-lg text-red-600">Couldn't import transaction</h1><p className="text-xs text-gray-500 bg-red-50 p-3 rounded-xl">{errorMessage}</p><button onClick={() => router.replace('/')} className="w-full bg-black text-white p-3 rounded-xl font-bold">Back to Dashboard</button></>}
      </div>
    </div>
  );
}

export default function ImportPage() {
  return <Suspense fallback={<div className="p-10 text-center text-gray-400">Loading import gateway...</div>}><ImportHandler /></Suspense>;
}
