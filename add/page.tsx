"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { addExpense } from "@/services/transactionService";
import { Mic, Square, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { translations } from "@/utils/i18n";

function AddExpenseContent() {
  const router = useRouter();
  const recognitionRef = useRef<any>(null);
  
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

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      if (speechText.trim()) processMultiExpenses(speechText);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("متصفحك لا يدعم تسجيل الصوت.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = isRTL ? 'ar-EG' : 'ar-SA'; 
    recognition.continuous = true;
    recognition.interimResults = true; 

    recognition.onresult = (event: any) => {
      let currentText = "";
      for (let i = 0; i < event.results.length; i++) currentText += event.results[i][0].transcript;
      setSpeechText(currentText);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        setIsListening(false);
        setMessage("❌ خطأ مايك: " + event.error);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
      setMessage("🎙️ أنا سامعك... خد راحتك في الكلام.");
    } catch (e) {
      setMessage("❌ تعذر تشغيل الميكروفون.");
    }
  };

  const processMultiExpenses = async (text: string) => {
    setIsProcessing(true);
    setMessage("🧠 جاري التحليل...");
    
    try {
      // قراءة المفتاح من متغيرات البيئة (Netlify)
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error("مفتاح API غير موجود في إعدادات التطبيق.");
      }

      const prompt = `Extract expenses from this text: "${text}". 
Return ONLY a valid JSON array of objects. Format: [{"amount": number, "merchant": "string"}]. 
If no expense found, return []. No markdown, no extra text.`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error("فشل الاتصال بسيرفر الذكاء الاصطناعي.");
      }

      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content || "[]";
      
      const match = aiText.match(/\[[\s\S]*\]/);
      const expenses = match ? JSON.parse(match[0]) : [];

      if (!Array.isArray(expenses) || expenses.length === 0) {
        setMessage("⚠️ مقدرتش أستخرج مصاريف واضحة، جرب تاني.");
        setIsProcessing(false);
        return;
      }

      const defaultCategory = await db.categories.where('type').equals('expense').first();
      
      for (const exp of expenses) {
        await addExpense({
          amount: Number(exp.amount),
          merchant: exp.merchant,
          categoryId: categoryId || defaultCategory?.id || "auto",
          type: 'manual',
          notes: `AI Voice: ${text}`
        });
      }

      setMessage(`✅ تم تسجيل ${expenses.length} معاملات بنجاح.`);
      setTimeout(() => router.push("/transactions"), 2000);
    } catch (error: any) {
      console.error(error);
      setMessage("❌ " + (error.message || "حدث خطأ غير متوقع"));
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
        type: 'manual',
        notes: note
      });
      router.push("/transactions");
    } catch (error) {
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
          <p className="text-xs text-blue-500 font-bold mb-1">🎙️ المايك بيسمع:</p>
          <p className="text-gray-800 font-medium leading-relaxed">{speechText}</p>
        </div>
      )}

      {message && <div className="mb-4 p-3 rounded-xl bg-blue-100 text-blue-700 font-medium text-center shadow-sm">{message}</div>}

      <button onClick={toggleListening} className={`w-full p-4 rounded-3xl mb-6 font-bold text-lg flex items-center justify-center gap-2 shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-black text-white'}`}>
        {isProcessing ? <Loader2 className="animate-spin" /> : isListening ? <Square /> : <Mic />}
        {isListening ? "إيقاف وإرسال" : "سجل مصروفك بالصوت (AI)"}
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