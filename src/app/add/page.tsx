use client";

import {
  useEffect,
  useRef,
  useState,
  Suspense,
} from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { addExpense } from "@/services/transactionService";
import {
  Mic,
  Square,
  Loader2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { translations } from "@/utils/i18n";

function AddExpenseContent() {
  const router = useRouter();

  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartRef = useRef(0);

  const categories = useLiveQuery(() =>
    db.categories.where("type").equals("expense").toArray()
  );
  const settings = useLiveQuery(() =>
    db.settings.get("user_settings")
  );

  const dialect = settings?.dialect || "en";
  const currency = settings?.currency || "SAR";
  const t =
    translations[dialect]?.addExpense ||
    translations.en.addExpense;
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
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const pickSupportedMimeType = () => {
    if (typeof MediaRecorder === "undefined") return undefined;

    const types = [
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg",
    ];

    return types.find((type) => MediaRecorder.isTypeSupported(type));
  };

  const processMultiExpenses = async (text: string) => {
    setMessage("🧠 جاري استخراج المصاريف...");

    try {
      const response = await fetch("/api/ai-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error || "فشل تحليل المصاريف."
        );
      }

      const expenses = Array.isArray(data.expenses)
        ? data.expenses
        : [];

      if (!expenses.length) {
        setMessage(
          "⚠️ مقدرتش أطلع مصاريف واضحة من الكلام."
        );
        return;
      }

      const defaultCategory = await db.categories
        .where("type")
        .equals("expense")
        .first();

      if (!defaultCategory) {
        throw new Error(
          "مفيش تصنيفات مصاريف موجودة في قاعدة البيانات."
        );
      }

      let savedCount = 0;

      for (const expense of expenses) {
        const saved = await addExpense(
          expense.amount,
          expense.merchant,
          categoryId || defaultCategory.id,
          "manual",
          `تسجيل صوتي: ${text}`
        );

        if (saved) savedCount++;
      }

      if (!savedCount) {
        throw new Error("لم يتم حفظ أي مصروف.");
      }

      setMessage(`✅ تم تسجيل ${savedCount} مصروف بنجاح.`);

      setTimeout(() => {
        router.push("/transactions");
      }, 1200);
    } catch (error) {
      console.error("Expense parsing error:", error);

      setMessage(
        `❌ ${
          error instanceof Error
            ? error.message
            : "حصل خطأ أثناء تحليل المصروف."
        }`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const stopAndProcessRecording = async (
    recorder: MediaRecorder
  ) => {
    streamRef.current?.getTracks().forEach((track) =>
      track.stop()
    );
    streamRef.current = null;

    const durationMs =
      Date.now() - recordingStartRef.current;

    const actualType =
      recorder.mimeType || "audio/webm";

    const extension = actualType.includes("mp4")
      ? "mp4"
      : actualType.includes("ogg")
      ? "ogg"
      : "webm";

    const audioBlob = new Blob(audioChunksRef.current, {
      type: actualType,
    });

    // لا نعتمد على حجم الملف وحده؛ بعض codecs تنتج ملفات صغيرة رغم وجود صوت.
    if (durationMs < 300) {
      setMessage(
        "⚠️ التسجيل قصير جدًا فعلًا. اتكلم لمدة ثانية على الأقل."
      );
      setIsProcessing(false);
      return;
    }

    if (audioBlob.size < 100) {
      setMessage(
        "⚠️ التسجيل فاضي أو المتصفح لم يرسل الصوت."
      );
      setIsProcessing(false);
      return;
    }

    try {
      setMessage("⏳ جاري تحويل الصوت لنص...");

      const formData = new FormData();
      formData.append(
        "file",
        audioBlob,
        `expense-audio.${extension}`
      );

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error || "فشل تحويل التسجيل إلى نص."
        );
      }

      const text =
        typeof data.text === "string"
          ? data.text.trim()
          : "";

      if (!text) {
        setMessage(
          "⚠️ الصوت وصل لكن مفيش كلام واضح اتفهم."
        );
        setIsProcessing(false);
        return;
      }

      setSpeechText(text);
      await processMultiExpenses(text);
    } catch (error) {
      console.error("Audio processing error:", error);

      setMessage(
        `❌ ${
          error instanceof Error
            ? error.message
            : "حصل خطأ أثناء معالجة الصوت."
        }`
      );

      setIsProcessing(false);
    }
  };

  const toggleRecording = async () => {
    if (isProcessing) return;

    if (isListening && recorderRef.current) {
      setIsProcessing(true);
      setIsListening(false);

      const recorder = recorderRef.current;
      recorderRef.current = null;

      // stop() يضمن إرسال آخر chunk قبل onstop.
      recorder.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage(
        "❌ المتصفح لا يدعم تسجيل الصوت."
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

      streamRef.current = stream;
      audioChunksRef.current = [];
      recordingStartRef.current = Date.now();

      const mimeType = pickSupportedMimeType();

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsListening(false);
        setIsProcessing(false);
        setMessage("❌ حصل خطأ في تسجيل الصوت.");
      };

      recorder.onstop = () => {
        void stopAndProcessRecording(recorder);
      };

      recorderRef.current = recorder;

      // نجمع chunks صغيرة لضمان وصول البيانات في Safari/iOS.
      recorder.start(250);

      setIsListening(true);
      setMessage(
        "🎙️ أنا سامعك... اتكلم براحتك، وبعدها دوس إيقاف."
      );
    } catch (error) {
      console.error("Microphone error:", error);

      streamRef.current?.getTracks().forEach((track) =>
        track.stop()
      );
      streamRef.current = null;

      setIsListening(false);
      setIsProcessing(false);

      setMessage(
        `❌ ${
          error instanceof Error
            ? error.message
            : "تعذر الوصول للمايك."
        }`
      );
    }
  };

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (
      isSubmitting ||
      !amount ||
      !merchant ||
      !categoryId
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      await addExpense(
        amount,
        merchant,
        categoryId,
        "manual",
        note
      );

      router.push("/transactions");
    } catch (error) {
      console.error(error);

      setMessage(
        `❌ ${
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء الحفظ."
        }`
      );

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
          type="button"
          onClick={() => router.back()}
          className={`p-2 ${
            isRTL ? "-mr-2" : "-ml-2"
          } bg-white rounded-full shadow-sm`}
        >
          {isRTL ? (
            <ArrowRight size={20} />
          ) : (
            <ArrowLeft size={20} />
          )}
        </button>

        <h1 className="text-2xl font-bold text-gray-900">
          {t.title}
        </h1>
      </header>

      {speechText && (
        <div className="mb-4 p-4 bg-white border border-blue-100 rounded-2xl shadow-sm">
          <p className="text-xs text-blue-500 font-bold mb-1">
            🎙️ فهمت الآتي:
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
        type="button"
        onClick={toggleRecording}
        disabled={isProcessing}
        className={`w-full p-4 rounded-3xl mb-6 font-bold text-lg flex items-center justify-center gap-2 shadow-sm ${
          isListening
            ? "bg-red-500 text-white animate-pulse"
            : "bg-black text-white"
        } disabled:opacity-60`}
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
          : "سجل مصروفك بالصوت (AI)"}
      </button>

      <form
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col gap-4"
      >
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-3">
          <span className="text-gray-400 font-medium">
            {currency}
          </span>

          <input
            type="number"
            step="0.01"
            inputMode="decimal"
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
          {isSubmitting ? "جاري الحفظ..." : t.save}
        </button>
      </form>
    </div>
  );
}

export default function AddExpense() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-center">
          جاري التحميل...
        </div>
      }
    >
      <AddExpenseContent />
    </Suspense>
  );
}
