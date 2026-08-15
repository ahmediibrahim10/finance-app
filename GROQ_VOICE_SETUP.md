# Groq Voice AI

مسار الصوت الآن:
Microphone -> MediaRecorder -> /api/transcribe -> Groq Whisper -> /api/ai-expense -> Groq LLM -> Dexie

## Environment
ضع المفتاح على السيرفر فقط:

GROQ_API_KEY=...

لا تستخدم NEXT_PUBLIC_GROQ_API_KEY.

## الموديلات
- Speech-to-text: whisper-large-v3
- Expense extraction: openai/gpt-oss-20b

## ملاحظات
- تم إلغاء Gemini من مسار AI Expense.
- لا يتم اعتبار حجم Blob وحده دليلًا على أن التسجيل قصير.
- يتم رفض التسجيل فقط إذا كانت مدته أقل من 300ms أو الـ Blob فارغ.
- استخراج المصاريف يستخدم Structured Outputs.
