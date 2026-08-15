import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Expense = {
  amount: number;
  merchant: string;
};

function cleanExpenses(value: unknown): Expense[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const rawAmount = Number((item as any).amount);
      const rawMerchant = String((item as any).merchant ?? "").trim();

      if (!Number.isFinite(rawAmount) || rawAmount <= 0 || !rawMerchant) {
        return null;
      }

      return {
        amount: Number(rawAmount.toFixed(2)),
        merchant: rawMerchant.slice(0, 120),
      };
    })
    .filter((item): item is Expense => item !== null);
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY غير مضبوط على السيرفر." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ expenses: [] });
    }

    const systemPrompt = `
أنت محلل مصروفات مالية.
مهمتك الوحيدة استخراج المصاريف المذكورة بوضوح من النص العربي أو المصري العامي.

القواعد:
1. استخرج كل مصروف مستقل.
2. amount يجب أن يكون رقمًا فقط وبالعملة المذكورة في النص.
3. لا تخترع أي مبلغ أو اسم تاجر غير موجود في النص.
4. لو المبلغ غير واضح، لا تستخرج العملية.
5. افهم اللهجة المصرية والعربية العامية والأرقام المكتوبة بالكلمات عندما تكون واضحة.
6. أمثلة: "دفعت 25 على قهوة" => 25 وقهوة.
7. "دفعت 40 لأوبر و120 في السوبر ماركت" => عمليتان.
8. أعد JSON فقط بالشكل:
{"expenses":[{"amount":25,"merchant":"قهوة"}]}
9. لا تضف markdown أو شرحًا.
`;

    const userPrompt = `النص:
${text}`;

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
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
      console.error("Groq expense parser error:", groqResponse.status, data);
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            `فشل تحليل المصاريف (${groqResponse.status}).`,
        },
        { status: groqResponse.status }
      );
    }

    const aiText =
      data?.choices?.[0]?.message?.content &&
      typeof data.choices[0].message.content === "string"
        ? data.choices[0].message.content
        : "";

    if (!aiText) {
      return NextResponse.json({ expenses: [] });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(aiText);
    } catch {
      const objectMatch = aiText.match(/\{[\s\S]*\}/);
      if (!objectMatch) {
        return NextResponse.json({ expenses: [] });
      }
      parsed = JSON.parse(objectMatch[0]);
    }

    return NextResponse.json({
      expenses: cleanExpenses(parsed?.expenses),
    });
  } catch (error) {
    console.error("ai-expense route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "خطأ داخلي في تحليل المصاريف.",
      },
      { status: 500 }
    );
  }
}
