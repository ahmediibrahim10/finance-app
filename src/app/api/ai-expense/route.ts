import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ expenses: [], error: 'النص فارغ.' }, { status: 200 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ expenses: [], error: 'GROQ_API_KEY غير مضبوط على السيرفر.' }, { status: 200 });
    }

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

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('Groq chat error:', response.status, errBody);
      return NextResponse.json(
        { expenses: [], error: errBody?.error?.message || `فشل الاتصال بسيرفر التحليل (${response.status}).` },
        { status: 200 }
      );
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || '{"expenses": []}';

    let parsed: any = { expenses: [] };
    try {
      parsed = JSON.parse(aiText);
    } catch {
      const match = aiText.match(/\[[\s\S]*\]/);
      parsed = { expenses: match ? JSON.parse(match[0]) : [] };
    }

    const expenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
    return NextResponse.json({ expenses });
  } catch (error: any) {
    console.error('ai-expense route error:', error);
    return NextResponse.json({ expenses: [], error: error?.message || 'Unknown error' }, { status: 200 });
  }
}