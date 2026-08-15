"use client";

import { useEffect, useRef, useState, Suspense } from "react";
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
  const recordingStartRef = useRef<number>(0);

  const categories = useLiveQuery(() =>
    db.categories.where("type").equals("expense").toArray()
  );
  const settings = useLiveQuery(() => db.settings.get("user_settings"));

  const dialect = settings?.dialect || "en";
  const currency = settings?.currency || "SAR";
  const t =
    translations[dialect]?.addExpense || translations.en.addExpense;
  const isRTL = dialect === "egyptian";

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
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const pickSupportedMimeType = () => {
    if (typeof MediaRecorder === "undefined") return undefined;

    const candidates = [
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];

    return candidates.find((type) => MediaRecorder.isTypeSupported(type));
  };

  const processRecordedAudio = async (recorder: MediaRecorder) => {
    const durationMs = Date.now() - recordingStartRef.current;
    const actualMimeType =
      recorder.mimeType || pickSupportedMimeType() || "audio/webm";

    const audioBlob = new Blob(audioChunksRef.current, {
      type: actualMimeType,
    });

    if (durationMs < 300) {
      setMessage("⚠️ التسجيل قصير جدًا. اتكلم ثانية أو ثانيتين وبعدين أوقف.");
      setIsProcessing(false);
      return;
    }

    if (audioBlob.size === 0) {
      setMessage("⚠️ لم يتم التقاط الصوت. جرّب مرة ثانية.");
      setIsProcessing(false);
      return;
    }

    try {
      const extension = actualMimeType.includes("mp4")
        ? "mp4"
        : actualMimeType.includes("ogg")
          ? "ogg"
          : "webm";

      const formData = new FormData();
      formData.append("file", audioBlob, `expense-${Date.now()}.${extension}`);

      setMessage("⏳ Groq بيسمع التسجيل...");

      const audioRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const audioData = await audioRes.json().catch(() => ({}));

      if (!audioRes.ok || audioData.error) {
        throw new Error(
          audioData.error || `فشل تحويل الصوت (${audioRes.status})`
        );
      }

      const text =
        typeof audioData.text === "string" ? audioData.text.trim() : "";

      if (!text) {
        throw new Error("مفيش كلام واضح في التسجيل.");
      }

      setSpeechText(text);
      await processMultiExpenses(text);
    } catch (error) {
      console.error("Audio processing error:", error);
      setMessage(
        `❌ ${error instanceof Error ? error.message : "حصل خطأ أثناء معالجة التسجيل."}`
      );
      setIsProcessing(false);
    }
  };

  const toggleRecording = async () => {
    if (isProcessing) return;

    if (isListening && mediaRecorderRef.current) {
      setIsProcessing(true);
      setMessage("⏳ بوقف التسجيل...");
      mediaRecorderRef.current.stop();
      setIsListening(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("❌ المتصفح ده لا يدعم تسجيل الصوت.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = pickSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordingStartRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setIsListening(false);
        setIsProcessing(false);
        setMessage("❌ حصل خطأ أثناء التسجيل.");
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.onstop = async () => {
        mediaRecorderRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        // نعطي المتصفح لحظة لتسليم آخر dataavailable في Safari.
        await new Promise((resolve) => setTimeout(resolve, 50));
        await processRecordedAudio(recorder);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsListening(true);
      setMessage("🎙️ أنا سامعك... اتكلم براحتك.");
    } catch (error) {
      console.error(error);
      setMessage(
        `❌ تعذر تشغيل المايك: ${
          error instanceof Error ? error.message : "تحقق من صلاحية الميكروفون."
        }`
      );
      setIsProcessing(false);
    }
  };

  const processMultiExpenses = async (text: string) => {
    setMessage("🧠 Groq بيحلل المصاريف...");

    try {
      const response = await fetch("/api/ai-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error) {
        throw new Error(data.error || "فشل تحليل المصاريف.");
      }

      const expenses = Array.isArray(data.expenses) ? data.expenses : [];

      if (!expenses.length) {
        setMessage("⚠️ سمعتك، بس مقدرتش أحدد مصروف واضح. جرّب تقول المبلغ والمكان.");
        setIsProcessing(false);
        return;
      }

      const defaultCategory = await db.categories
        .where("type")
        .equals("expense")
        .first();

      if (!defaultCategory) {
        throw new Error("مفيش تصنيف مصاريف موجود في التطبيق.");
      }

      for (const expense of expenses) {
        await addExpense(
          Number(expense.amount),
          expense.merchant,
          categoryId || defaultCategory.id,
          "manual",
          `تسجيل صوتي: ${text}`
        );
      }

      setMessage(`✅ تم تسجيل ${expenses.length} مصروف بنجاح.`);
      setTimeout(() => router.push("/transactions"), 1200);
    } catch (error) {
      console.error("Expense parsing error:", error);
      setMessage(
        `❌ ${error instanceof Error ? error.message : "حصل خطأ في حفظ المصاريف."}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isSubmitting) return;

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage("❌ اكتب مبلغ صحيح.");
      return;
    }

    if (!merchant.trim() || !categoryId) {
      setMessage("❌ اكتب المكان واختار التصنيف.");
      return;
    }

    setIsSubmitting(true);

    try {
      await addExpense(
        numericAmount,
        merchant,
        categoryId,
        "manual",
        note
      );
      router.push("/transactions");
    } catch (error) {
      console.error(error);
      setMessage("❌ حدث خطأ أثناء حفظ المصروف.");
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="p-4 pt-safe pb-28 min-h-screen flex flex-col bg-gray-50 font-sans"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <header className="py-2 mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className={`p-2 ${isRTL ? "-mr-2" : "-ml-2"} bg-white rounded-full shadow-sm`}
        >
          {isRTL ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
      </header>

      {speechText && (
        <div className="mb-4 p-4 bg-white border border-blue-100 rounded-2xl shadow-sm">
          <p className="text-xs text-blue-500 font-bold mb-1">
            🎙️ Groq فهم:
          </p>
          <p className="text-gray-800 font-medium leading-relaxed">
            {speechText}
          </p>
        </div>
      )}

      {message && (
        <div className="mb-4 p-3 rounded-xl bg-blue-100 text-blue-700 font-medium text-center shadow-sm">
          {message}
        </div>
      )}

      <button
        onClick={toggleRecording}
        disabled={isProcessing}
        className={`w-full p-4 rounded-3xl mb-6 font-bold text-lg flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 ${
          isListening
            ? "bg-red-500 text-white animate-pulse"
            : "bg-black text-white"
        }`}
      >
        {isProcessing ? (
          <Loader2 className="animate-spin" />
        ) : isListening ? (
          <Square />
        ) : (
          <Mic />
        )}
        {isProcessing
          ? "جاري المعالجة..."
          : isListening
            ? "إيقاف التسجيل وإرسال"
            : "سجل مصروفك بالصوت (Groq AI)"}
      </button>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-3">
          <span className="text-gray-400 font-medium">{currency}</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 text-3xl font-bold bg-transparent outline-none"
            placeholder="0.00"
          />
        </div>

        <input
          type="text"
          required
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          className="w-full p-4 bg-white rounded-3xl text-lg font-medium outline-none shadow-sm"
          placeholder={t.merchant}
        />

        <select
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full p-4 bg-white rounded-3xl text-lg font-medium outline-none shadow-sm"
        >
          <option value="" disabled>
            {t.selectCategory}
          </option>
          {categories?.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full p-4 bg-white rounded-3xl text-lg outline-none shadow-sm"
          placeholder={t.note}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-4 bg-gray-900 text-white p-4 rounded-2xl font-bold text-lg disabled:opacity-50"
        >
          {isSubmitting ? t.saving : t.save}
        </button>
      </form>
    </div>
  );
}

export default function AddExpense() {
  return (
    <Suspense fallback={<div>جاري التحميل...</div>}>
      <AddExpenseContent />
    </Suspense>
  );
}
