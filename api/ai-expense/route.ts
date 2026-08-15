import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    
    // دعم قراءة المفتاح بأي اسم (سواء الجديد أو القديم)
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "مفتاح الـ API غير موجود على السيرفر" }, { status: 400 });
    }

    if (!text || !text.trim()) {
      return NextResponse.json({ expenses: [] });
    }

    const prompt = `Extract expenses from this text: "${text}". 
Return ONLY a valid JSON array of objects. Format: [{"amount": number, "merchant": "string"}]. 
If no expense found, return []. No markdown, no extra text.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || "خطأ من سيرفر جوجل للذكاء الاصطناعي");
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    // استخراج الـ JSON بدقة مهما كان الرد
    const match = aiText.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ expenses: [] });
    }

    const expenses = JSON.parse(match[0]);
    return NextResponse.json({ expenses: Array.isArray(expenses) ? expenses : [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "خطأ داخلي في الخادم" }, { status: 500 });
  }
}