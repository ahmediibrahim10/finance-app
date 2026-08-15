"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { addExpense } from "@/services/transactionService";
import { Mic, Square, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { translations } from "@/utils/i18n";

function AddExpenseContent() {
  const router = useRouter();
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray());
  const settings = useLiveQuery(() => db.settings.get('user_settings'));

  const dialect = settings?.dialect || 'en';
  const currency = settings?.currency || 'SAR';
  const t = translations[dialect]?.addExpense || translations['en'].addExpense;
  const isRTL = dialect === 'egyptian';

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [speechText, setSpeechText] = useState("");

  // تنضيف المايك لو المستخدم غادر الصفحة وهو لسه بيسجل
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  function AddExpenseContent() {
  const router = useRouter();
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartRef = useRef<number>(0);

  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray());
  const settings = useLiveQuery(() => db.settings.get('user_settings'));

  const dialect = settings?.dialect || 'en';
  const currency = settings?.currency || 'SAR';
  const t = translations[dialect]?.addExpense || translations['en'].addExpense;
  const isRTL = dialect === 'egyptian';

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [speechText, setSpeechText] = useState("");

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // أفضل mimeType مدعوم فعليًا في المتصفح الحالي - iOS Safari بيحتاج audio/mp4
  // بدل ما نسيب الاختيار للمتصفح لوحده وممكن يرجع Blob فاضي
  const pickSupportedMimeType = (): string | undefined => {
    const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
    for (const type of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) {
        return type;
      }
    }
    return undefined; // نسيب المتصفح يختار الافتراضي لو ولا واحد مدعوم صراحةً
  };

  const toggleRecording = async () => {
    if (isListening && mediaRecorderRef.current) {
      setIsProcessing(true);
      mediaRecorderRef.current.stop();
      setIsListening(false);
      setMessage("⏳ جاري تحويل الصوت لنص...");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recordingStartRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;

        const durationMs = Date.now() - recordingStartRef.current;
        const actualMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const extension = actualMimeType.includes('mp4') ? 'mp4' : actualMimeType.includes('ogg') ? 'ogg' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });

        // بنعتمد على المدة الفعلية للتسجيل مش حجم البايتات بس،
        // لأن الحجم بيختلف حسب الـ codec وممكن يبان "صغير" حتى لو الصوت واضح
        if (durationMs < 600 || audioBlob.size < 500) {
          setMessage("⚠️ التسجيل كان قصير جداً، حاول تتكلم بوضوح أكتر واستنى ثانية قبل ما توقف.");
          setIsProcessing(false);
          return;
        }

        try {
          const formData = new FormData();
          formData.append("file", audioBlob, `audio.${extension}`);

          const audioRes = await fetch("/api/transcribe", {
            method: 'POST',
            body: formData,
          });

          const audioData = await audioRes.json();

          if (!audioRes.ok || audioData.error) {
            throw new Error(audioData.error || `رفض من السيرفر برمز: ${audioRes.status}`);
          }

          const text = audioData.text;
          if (!text || text.trim() === "") {
            setMessage("⚠️ لم يتم التقاط صوت واضح، جرب تعلي صوتك.");
            setIsProcessing(false);
            return;
          }

          setSpeechText(text);
          await processMultiExpenses(text);

        } catch (error) {
          console.error("Audio Process Error:", error);
          const errorMessage = error instanceof Error ? error.message : "خطأ غير معروف";
          setMessage(`❌ المشكلة: ${errorMessage}`);
          setIsProcessing(false);
        }
      };

      // timeslice بيخلي الـ chunks تتجمع كل 250ms بدل ما تستنى للنهاية بس - أكثر ثباتًا على iOS
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsListening(true);
      setMessage("🎙️ أنا سامعك... اتكلم براحتك.");

    } catch (err) {
      console.error(err);
      const errMessage = err instanceof Error ? err.message : "تعذر الوصول للمايك";
      setMessage(`❌ تعذر تشغيل المايك: ${errMessage}`);
      setIsProcessing(false);
    }
  };

  const processMultiExpenses = async (text: string) => {
    setMessage("🧠 جاري استخراج المصاريف...");
    try {
      const response = await fetch("/api/ai-expense", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "فشل الاتصال بسيرفر التحليل.");
      }

      const expenses = Array.isArray(data.expenses) ? data.expenses : [];

      if (expenses.length === 0) {
        setMessage("⚠️ مقدرتش أستخرج مصاريف واضحة، جرب تاني.");
        setIsProcessing(false);
        return;
      }

      const defaultCategory = await db.categories.where('type').equals('expense').first();

      for (const exp of expenses) {
        // كانت بتتبعت type/notes وهي أسماء مش موجودة في addExpense، فالملاحظة كانت بتضيع دايماً - اتصلحت لـ source/note
        await addExpense({
          amount: Number(exp.amount),
          merchant: exp.merchant,
          categoryId: categoryId || defaultCategory?.id || "auto",
          source: 'manual',
          note: `تسجيل صوتي: ${text}`,
        });
      }

      setMessage(`✅ تم تسجيل ${expenses.length} معاملات بنجاح.`);
      setTimeout(() => router.push("/transactions"), 2000);
      setIsProcessing(false);

    } catch (error) {
      console.error("Parse Error:", error);
      const errorMessage = error instanceof Error ? error.message : "خطأ في فهم البيانات، حاول بكلمات أبسط.";
      setMessage(`❌ ${errorMessage}`);
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addExpense({
        amount: Number(amount),
        merchant,
        categoryId,
        source: 'manual',
        note,
      });
      router.push("/transactions");
    } catch (error) {
      console.error(error);
      setMessage("❌ حدث خطأ أثناء الحفظ اليدوي");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 pt-safe pb-28 min-h-screen flex flex-col bg-gray-50 font-sans" dir={isRTL ? "rtl" : "ltr"}>
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

      {message && <div className="mb-4 p-3 rounded-xl bg-blue-100 text-blue-700 font-medium text-center shadow-sm">{message}</div>}

      <button onClick={toggleRecording} className={`w-full p-4 rounded-3xl mb-6 font-bold text-lg flex items-center justify-center gap-2 shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-black text-white'}`}>
        {isProcessing ? <Loader2 className="animate-spin" /> : isListening ? <Square /> : <Mic />}
        {isListening ? "إيقاف التسجيل وإرسال" : "سجل مصروفك بالصوت (AI)"}
      </button>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-3">
          <span className="text-gray-400 font-medium">{currency}</span>
          <input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1 text-3xl font-bold bg-transparent outline-none" placeholder="0.00" />
        </div>
        <input type="text" required value={merchant} onChange={(e) => setMerchant(e.target.value)} className="w-full p-4 bg-white rounded-3xl text-lg font-medium outline-none shadow-sm" placeholder={t.merchant} />

        <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full p-4 bg-white rounded-3xl text-lg font-medium outline-none shadow-sm">
          <option value="" disabled>{t.selectCategory}</option>
          {categories?.map((cat) => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
        </select>

        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-4 bg-white rounded-3xl text-lg outline-none shadow-sm" placeholder={t.note} />

        <button type="submit" disabled={isSubmitting} className="w-full mt-4 bg-gray-900 text-white p-4 rounded-2xl font-bold text-lg">
          {isSubmitting ? "جاري الحفظ..." : t.save}
        </button>
      </form>
    </div>
  );
}

export default function AddExpense() {
  return <Suspense fallback={<div>جاري التحميل...</div>}><AddExpenseContent /></Suspense>;
}