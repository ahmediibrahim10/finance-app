import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

    const form = await request.formData();
    const audioFile = form.get("file");

    if (!(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "لم يتم استلام ملف صوتي صالح." },
        { status: 400 }
      );
    }

    if (audioFile.size === 0) {
      return NextResponse.json(
        { error: "ملف التسجيل فاضي." },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "ملف التسجيل كبير جدًا." },
        { status: 413 }
      );
    }

    const fileName =
      audioFile instanceof File && audioFile.name
        ? audioFile.name
        : "expense-audio.webm";

    const forwardForm = new FormData();
    forwardForm.append("file", audioFile, fileName);
    forwardForm.append("model", "whisper-large-v3");
    forwardForm.append("language", "ar");
    forwardForm.append(
      "prompt",
      "تسجيل صوتي لمصاريف يومية باللهجة المصرية والعربية العامية. قد يحتوي على: دفعت، اشتريت، جبت، دفعت كام، بـ، جنيه، ريال، قهوة، فطار، غدا، عشا، أوبر، كريم، مواصلات، فاتورة، سوبر ماركت."
    );

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: forwardForm,
      }
    );

    const responseText = await groqResponse.text();

    let data: any = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = {};
    }

    if (!groqResponse.ok) {
      console.error("Groq transcription error:", groqResponse.status, data);
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            `فشل تحويل الصوت لنص (${groqResponse.status}).`,
        },
        { status: groqResponse.status }
      );
    }

    const text = typeof data?.text === "string" ? data.text.trim() : "";

    return NextResponse.json({ text });
  } catch (error) {
    console.error("transcribe route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "خطأ غير معروف أثناء تحويل الصوت.",
      },
      { status: 500 }
    );
  }
}
