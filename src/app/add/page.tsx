"use client";

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { addExpense } from '@/services/transactionService';
import { Mic, Square, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { translations } from '@/utils/i18n';

function AddExpenseContent() {
  const router = useRouter();
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const categories = useLiveQuery(() =>
    db.categories.where('type').equals('expense').toArray()
  );
  const settings = useLiveQuery(() => db.settings.get('user_settings'));

  const dialect = settings?.dialect || 'en';
  const currency = settings?.currency || 'SAR';
  const t = translations[dialect]?.addExpense || translations.en.addExpense;
  const isRTL = dialect === 'egyptian';

  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [speechText, setSpeechText] = useState('');

  useEffect(() => () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const pickMimeType = () => {
    const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
    return candidates.find(type =>
      typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)
    );
  };

  const processMultiExpenses = async (text: string) => {
    setIsProcessing(true);
    setMessage('🧠 جاري استخراج المصاريف...');

    try {
      const response = await fetch('/api/ai-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'فشل تحليل المصاريف.');

      const expenses = Array.isArray(data.expenses) ? data.expenses : [];
      if (!expenses.length) {
        setMessage('⚠️ مقدرتش أستخرج مصاريف واضحة، جرب تاني.');
        return;
      }

      const defaultCategory = categoryId
        ? undefined
        : await db.categories.where('type').equals('expense').first();

      for (const expense of expenses) {
        const parsedAmount = Number(expense.amount);
        const parsedMerchant = String(expense.merchant || '').trim();

        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !parsedMerchant) continue;

        await addExpense({
          amount: parsedAmount,
          merchant: parsedMerchant,
          categoryId: categoryId || defaultCategory?.id || '',
          source: 'manual',
          note: `تسجيل صوتي: ${text}`,
        });
      }

      setMessage(`✅ تم تسجيل ${expenses.length} معاملات بنجاح.`);
      setTimeout(() => router.push('/transactions'), 1200);
    } catch (error) {
      console.error(error);
      setMessage(`❌ ${error instanceof Error ? error.message : 'حدث خطأ غير متوقع.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleRecording = async () => {
    if (isListening) {
      recorderRef.current?.stop();
      setIsListening(false);
      setIsProcessing(true);
      setMessage('⏳ جاري تحويل الصوت لنص...');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMessage('❌ متصفحك لا يدعم تسجيل الصوت.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;

        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        });

        if (blob.size < 500) {
          setIsProcessing(false);
          setMessage('⚠️ التسجيل قصير جداً أو لم يتم التقاط صوت.');
          return;
        }

        try {
          const formData = new FormData();
          formData.append('file', blob, `audio.${(recorder.mimeType || mimeType || '').includes('mp4') ? 'mp4' : 'webm'}`);

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();
          if (!response.ok || data.error) throw new Error(data.error || 'فشل تحويل الصوت.');

          const text = String(data.text || '').trim();
          if (!text) throw new Error('لم يتم التقاط كلام واضح.');

          setSpeechText(text);
          await processMultiExpenses(text);
        } catch (error) {
          setIsProcessing(false);
          setMessage(`❌ ${error instanceof Error ? error.message : 'خطأ في معالجة الصوت.'}`);
        }
      };

      recorderRef.current = recorder;
      recorder.start(250);
      setIsListening(true);
      setMessage('🎙️ أنا سامعك... اتكلم براحتك.');
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : 'تعذر تشغيل المايك.'}`);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addExpense({ amount, merchant, categoryId, source: 'manual', note });
      router.push('/transactions');
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : 'حدث خطأ أثناء الحفظ.'}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 pt-safe pb-28 min-h-screen flex flex-col bg-gray-50 font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="py-2 mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className={`p-2 ${isRTL ? '-mr-2' : '-ml-2'} bg-white rounded-full shadow-sm`}>
          {isRTL ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
      </header>

      {speechText && (
        <div className="mb-4 p-4 bg-white border border-blue-100 rounded-2xl shadow-sm">
          <p className="text-xs text-blue-500 font-bold mb-1">🎙️ فهمت الآتي:</p>
          <p className="text-gray-800 font-medium leading-relaxed">{speechText}</p>
        </div>
      )}

      {message && <div className="mb-4 p-3 rounded-xl bg-blue-100 text-blue-700 font-medium text-center">{message}</div>}

      <button
        onClick={toggleRecording}
        disabled={isProcessing}
        className={`w-full p-4 rounded-3xl mb-6 font-bold text-lg flex items-center justify-center gap-2 shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-black text-white'} disabled:opacity-60`}
      >
        {isProcessing ? <Loader2 className="animate-spin" /> : isListening ? <Square /> : <Mic />}
        {isListening ? 'إيقاف التسجيل وإرسال' : 'سجل مصروفك بالصوت (AI)'}
      </button>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-3">
          <span className="text-gray-400 font-medium">{currency}</span>
          <input type="number" step="0.01" min="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="flex-1 text-3xl font-bold bg-transparent outline-none" placeholder="0.00" />
        </div>
        <input type="text" required value={merchant} onChange={e => setMerchant(e.target.value)} className="w-full p-4 bg-white rounded-3xl text-lg font-medium outline-none shadow-sm" placeholder={t.merchant} />
        <select required value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full p-4 bg-white rounded-3xl text-lg font-medium outline-none shadow-sm">
          <option value="" disabled>{t.selectCategory}</option>
          {categories?.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
        </select>
        <input type="text" value={note} onChange={e => setNote(e.target.value)} className="w-full p-4 bg-white rounded-3xl text-lg outline-none shadow-sm" placeholder={t.note} />
        <button type="submit" disabled={isSubmitting} className="w-full mt-4 bg-gray-900 text-white p-4 rounded-2xl font-bold text-lg disabled:opacity-50">
          {isSubmitting ? t.saving : t.save}
        </button>
      </form>
    </div>
  );
}

export default function AddExpense() {
  return <Suspense fallback={<div>جاري التحميل...</div>}><AddExpenseContent /></Suspense>;
}
