import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY; // متغير سيرفر فقط - من غير NEXT_PUBLIC_
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY غير مضبوط على السيرفر.' }, { status: 200 });
    }

    const incomingForm = await request.formData();
    const audioFile = incomingForm.get('file');

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ error: 'لم يتم استلام ملف صوتي.' }, { status: 400 });
    }

    const forwardForm = new FormData();
    forwardForm.append('file', audioFile, (audioFile as any).name || 'audio.webm');
    forwardForm.append('model', 'whisper-large-v3');
    forwardForm.append('language', 'ar');
    forwardForm.append(
      'prompt',
      'تسجيل صوتي لمصروفات يومية باللهجة المصرية والعربية العامية. كلمات مثل: دفعت، اشتريت، جبت، بـ، جنيه، ريال، مواصلات، كهرباء، فطار، غدا، عشا، فاتورة.'
    );

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: forwardForm,
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.json().catch(() => ({}));
      console.error('Groq transcription error:', groqRes.status, errBody);
      return NextResponse.json(
        { error: errBody?.error?.message || `فشل تحويل الصوت لنص (${groqRes.status}).` },
        { status: 200 }
      );
    }

    const data = await groqRes.json();
    return NextResponse.json({ text: data.text || '' });
  } catch (error: any) {
    console.error('transcribe route error:', error);
    return NextResponse.json({ error: error?.message || 'خطأ غير معروف أثناء تحويل الصوت.' }, { status: 200 });
  }
}