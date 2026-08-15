"use client";

import { useState, useRef, Suspense } from "react";
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
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // التسجيل المباشر وإرساله لـ Groq Whisper مع توجيه اللهجة
  // الحل الجذري: التسجيل الديناميكي وإظهار الخطأ الحقيقي
  const toggleRecording = async () => {
    if (isListening && mediaRecorder) {
      mediaRecorder.stop();
      setIsListening(false);
      setMessage("⏳ جاري تحويل الصوت لنص...");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // 1. اكتشاف صيغة التسجيل المدعومة في المتصفح تلقائياً (عشان سفاري غير أندرويد)
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setIsProcessing(true);
        
        // 2. تسمية الملف بامتداد صحيح يطابق نوع التسجيل عشان Groq مايرفضوش
        const finalMime = mimeType || 'audio/webm';
        const extension = finalMime.includes('mp4') ? 'm4a' : 'webm'; // m4a هي الصيغة الصوتية لآبل
        
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });
        const file = new File([audioBlob], `audio.${extension}`, { type: finalMime });

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        try {
          const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
          // لو المفتاح مش موجود، هنقولك فوراً
          if (!apiKey) throw new Error("مفتاح API غير متوفر! تأكد من إعدادات Netlify واعمل Deploy جديد.");

          const formData = new FormData();
          formData.append("file", file);
          formData.append("model", "whisper-large-v3");
          formData.append("language", "ar"); 
          formData.append("prompt", "تسجيل صوتي لمصروفات يومية باللهجة المصرية والعربية العامية. كلمات مثل: دفعت، اشتريت، جبت، بـ، جنيه، ريال، مواصلات، كهرباء، فطار، غدا، عشا، فاتورة.");

          const audioRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData
          });

          // 3. لو السيرفر رفض، هنقرأ رسالة الخطأ الحقيقية منه ونعرضها لك!
          if (!audioRes.ok) {
            const errorData = await audioRes.json().catch(() => ({}));
            console.error("Groq Server Error:", errorData);
            throw new Error(errorData.error?.message || `رفض من السيرفر برمز: ${audioRes.status}`);
          }
          
          const audioData = await audioRes.json();
          const text = audioData.text;
          
          if (!text || text.trim() === "") {
            setMessage("⚠️ لم يتم التقاط صوت واضح، جرب تعلي صوتك.");
            setIsProcessing(false);
            return;
          }

          setSpeechText(text);
          await processMultiExpenses(text);

        } catch (error: any) {
          console.error("Audio Process Error:", error);
          // هنا هيظهرلك سبب المشكلة الحقيقي 100% على الشاشة
          setMessage(`❌ المشكلة: ${error.message}`);
          setIsProcessing(false);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsListening(true);
      setMessage("🎙️ أنا سامعك... اتكلم براحتك.");

    } catch (err: any) {
      console.error(err);
      setMessage(`❌ تعذر تشغيل المايك: ${err.message}`);
    }
  };

  const processMultiExpenses = async (text: string) => {
    setMessage("🧠 جاري استخراج المصاريف...");
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("مفتاح API غير موجود");

      // توجيه صارم للموديل عشان يفهم العامية والمصري ويرجع JSON
      const prompt = `أنت محاسب ذكي تفهم اللهجة المصرية العامية والعربية الفصحى بشكل ممتاز.
النص التالي يحتوي على مصروفات سجلها المستخدم بصوته: "${text}".

المطلوب:
1. استخراج كل مصروف مذكور.
2. تجاهل الكلمات الزائدة (مثل: دفعت، اشتريت، جبت، صرفت، بـ، جنيه، ريال).
3. استخراج المبلغ (amount) كرقم، واسم المصروف (merchant) كنص واضح.
4. قم بإرجاع كائن JSON فقط (ONLY JSON) يحتوي على مصفوفة باسم "expenses".

مثال للرد المطلوب لو النص كان "جبت فطار بعشرين ومواصلات بـ 15 و 300 كهربا":
{
  "expenses": [
    { "amount": 20, "merchant": "فطار" },
    { "amount": 15, "merchant": "مواصلات" },
    { "amount": 300, "merchant": "كهرباء" }
  ]
}`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) throw new Error("فشل الاتصال بسيرفر التحليل.");

      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content || '{"expenses": []}';
      
      const parsedData = JSON.parse(aiText);
      const expenses = parsedData.expenses || [];

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
          notes: `تسجيل صوتي: ${text}`
        });
      }

      setMessage(`✅ تم تسجيل ${expenses.length} معاملات بنجاح.`);
      setTimeout(() => router.push("/transactions"), 2000);
      
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Parse Error:", error);
      setMessage("❌ خطأ في فهم البيانات، حاول بكلمات أبسط.");
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