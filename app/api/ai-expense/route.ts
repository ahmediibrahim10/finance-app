import { NextResponse } from 'next/server';

function cleanJson(text: string): unknown[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ expenses: [] });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'مفتاح الـ API غير موجود على السيرفر.' }, { status: 500 });
    }

    const prompt = `You are a financial expense extraction engine.
Extract every clear expense from the following Arabic/Egyptian Arabic text.

Rules:
- Return ONLY a JSON array.
- Each item must be {"amount": number, "merchant": "string"}.
- Amount must be a positive number in the spoken currency units.
- Do not invent amounts or merchants.
- Ignore income, balances, transfers, and unclear numbers.
- If there are no clear expenses, return [].

Text:
${JSON.stringify(text)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      },
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'خطأ من مزود الذكاء الاصطناعي.');
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const expenses = cleanJson(aiText)
      .map(item => ({
        amount: Number((item as any)?.amount),
        merchant: String((item as any)?.merchant || '').trim(),
      }))
      .filter(item => Number.isFinite(item.amount) && item.amount > 0 && item.merchant);

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error('AI expense error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'خطأ داخلي في الخادم.' },
      { status: 500 },
    );
  }
}
