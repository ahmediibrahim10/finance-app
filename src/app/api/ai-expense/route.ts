import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

type Expense = {
  amount: number;
  merchant: string;
};

function sanitizeExpenses(value: unknown): Expense[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const amount = Number((item as any)?.amount);
      const merchant = String((item as any)?.merchant ?? "").trim();

      if (!Number.isFinite(amount) || amount <= 0 || !merchant) return null;

      return {
        amount: Math.round(amount * 100) / 100,
        merchant: merchant.slice(0, 120),
      };
    })
    .filter((x): x is Expense => Boolean(x));
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

    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ expenses: [] });
    }

    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `
أنت محلل مصروفات ذكي. مهمتك الوحيدة استخراج المصاريف من كلام عربي أو مصري عامي.

القواعد:
- استخرج كل عملية صرف مستقلة، وليس إجمالي الكلام فقط.
- "دفعت 25 قهوة و40 أوبر" = عمليتان.
- amount يجب أن يكون الرقم المدفوع فقط.
- merchant هو المكان/الخدمة/الشيء الذي تم الدفع له، بدون كلام زائد.
- افهم الأرقام العربية والعامية مثل: خمسة وعشرين، تلاتين، مية وعشرين.
- افهم "بـ25" و"بخمسة وعشرين" و"دفعت 25 ريال".
- لا تعتبر رقمًا راتبًا أو دخلًا مصروفًا إلا إذا كان واضحًا أنه تم دفعه.
- لا تخترع مبلغًا غير موجود.
- إذا لم يكن هناك مصروف واضح، أرجع مصفوفة فارغة.
- لا تضف عملة إلى amount.
- لا تكرر نفس العملية.
- الرد يجب أن يكون JSON فقط.
            `.trim(),
          },
          {
            role: "user",
            content: `النص المراد تحليله:\n${text}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "expense_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                expenses: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      amount: { type: "number" },
                      merchant: { type: "string" },
                    },
                    required: ["amount", "merchant"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["expenses"],
              additionalProperties: false,
            },
          },
        },
      }),
      cache: "no-store",
    });

    const responseText = await response.text();
    let data: any = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      console.error("Groq expense extraction error:", response.status, data);
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            `فشل تحليل المصروفات (${response.status}).`,
        },
        { status: response.status }
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Groq لم يرجع نتيجة تحليل صالحة." },
        { status: 502 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "نتيجة Groq ليست JSON صالحة." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      expenses: sanitizeExpenses(parsed?.expenses),
      transcript: text,
    });
  } catch (error) {
    console.error("ai-expense route error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "خطأ داخلي في تحليل المصروفات." },
      { status: 500 }
    );
  }
}
