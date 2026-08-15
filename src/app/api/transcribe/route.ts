import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY غير مضبوط على السيرفر." },
        { status: 500 }
      );
    }

    const incomingForm = await request.formData();
    const audioFile = incomingForm.get("file");

    if (!(audioFile instanceof File) || audioFile.size === 0) {
      return NextResponse.json(
        { error: "لم يتم استلام تسجيل صوتي صالح." },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "ملف التسجيل كبير جدًا. حاول تسجيل مقطع أقصر." },
        { status: 413 }
      );
    }

    const forwardForm = new FormData();
    forwardForm.append("file", audioFile, audioFile.name || "voice.webm");
    forwardForm.append("model", "whisper-large-v3");
    forwardForm.append("language", "ar");
    forwardForm.append(
      "prompt",
      "تسجيل مصاريف يومية باللهجة المصرية والعربية العامية. " +
        "أسماء وألفاظ محتملة: دفعت، صرفت، اشتريت، جبت، بـ، جنيه، ريال، هللة، " +
        "قهوة، مطعم، بقالة، سوبر ماركت، أوبر، كريم، مواصلات، بنزين، فاتورة، كهرباء، " +
        "مياه، فطار، غدا، عشا، نت، اشتراك."
    );

    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: forwardForm,
        cache: "no-store",
      }
    );

    const responseText = await groqRes.text();
    let data: any = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = {};
    }

    if (!groqRes.ok) {
      console.error("Groq transcription error:", groqRes.status, data);
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            `فشل تحويل الصوت إلى نص (${groqRes.status}).`,
        },
        { status: groqRes.status }
      );
    }

    const text = typeof data?.text === "string" ? data.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "Groq لم يجد كلامًا واضحًا في التسجيل." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("transcribe route error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "خطأ أثناء تحويل الصوت." },
      { status: 500 }
    );
  }
}
